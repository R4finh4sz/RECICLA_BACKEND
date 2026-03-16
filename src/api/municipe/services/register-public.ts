// Service do módulo Municipe: autenticação do munícipe e emissão de JWT.

import bcrypt from 'bcryptjs';
import { ZodError } from 'zod';
import { MunicipeLoginSchema, MunicipeLoginInput } from '../validation/MunicipeLoginSchema';
import { sendEmail } from './helpers/send-email';

function addMinutes(date: Date, minutes: number) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function addHours(date: Date, hours: number) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

function getClientIp(ctx: any) {
  return (
    ctx.request?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
    ctx.request?.ip ||
    ctx.req?.socket?.remoteAddress ||
    'unknown'
  );
}

function getUserAgent(ctx: any) {
  return String(ctx.request?.headers?.['user-agent'] || 'unknown');
}

async function getOrCreateAuthSecurity(strapi: any, userId: any) {
  let sec = await strapi.documents('api::auth-security.auth-security').findFirst({
    filters: { user: { id: userId as any } },
  });

  if (!sec) {
    sec = await strapi.documents('api::auth-security.auth-security').create({
      data: { user: userId },
    });
  }

  return sec;
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    // 1) Validar payload
    let data: MunicipeLoginInput;
    try {
      data = MunicipeLoginSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) return ctx.badRequest('Credenciais inválidas.');
      throw err;
    }

    const email = data.email.trim().toLowerCase();
    const ip = getClientIp(ctx);
    const userAgent = getUserAgent(ctx);

    const genericError = () => ctx.badRequest('Credenciais inválidas.');

    // 2) Buscar usuário (e role)
    const user = await strapi.documents('plugin::users-permissions.user').findFirst({
      filters: { email },
      fields: ['id', 'email', 'password', 'blocked', 'confirmed'],
      populate: { role: { fields: ['name'] } },
    });

    if (!user) return genericError();

    const roleName = (user as any).role?.name || (user as any).role;
    if (roleName !== 'Municipe') return genericError();
    if ((user as any).blocked === true) return genericError();

    const userId = (user as any).id;

    // 3) First-access-control
    const fac = await strapi.documents('api::first-access-control.first-access-control').findFirst({
      filters: { user: { id: userId as any } },
    });

    // 4) Controle de tentativas/bloqueio
    const sec = await getOrCreateAuthSecurity(strapi, userId);
    const secId = String((sec as any).documentId || (sec as any).id);

    const now = new Date();
    const isFirstAccess = Boolean(fac && (fac as any).mustChangePassword);

    const blockedUntil = isFirstAccess
      ? (sec as any).firstAccessBlockedUntil
      : (sec as any).loginBlockedUntil;

    if (blockedUntil && new Date(blockedUntil).getTime() > now.getTime()) {
      return genericError();
    }

    // 5) Validar senha
    const hashed = (user as any).password;
    if (!hashed) return genericError();

    const ok = await bcrypt.compare(data.password, hashed);

    if (!ok) {
      if (isFirstAccess) {
        const next = Number((sec as any).firstAccessFailedAttempts || 0) + 1;
        const updateData: any = { firstAccessFailedAttempts: next };

        // 5 tentativas, bloqueia por 1 hora
        if (next >= 5) {
          updateData.firstAccessBlockedUntil = addHours(now, 1).toISOString();
          updateData.firstAccessFailedAttempts = 0;
        }

        await strapi.documents('api::auth-security.auth-security').update({
          documentId: secId,
          data: updateData,
        });
      } else {
        const next = Number((sec as any).failedLoginAttempts || 0) + 1;
        const updateData: any = { failedLoginAttempts: next };

        // 5 tentativas, bloqueia por 15 min
        if (next >= 5) {
          updateData.loginBlockedUntil = addMinutes(now, 15).toISOString();
          updateData.failedLoginAttempts = 0;
        }

        await strapi.documents('api::auth-security.auth-security').update({
          documentId: secId,
          data: updateData,
        });
      }

      return genericError();
    }

    // 6) Notificação de novo acesso
    const previousIp = (sec as any).lastLoginIp ? String((sec as any).lastLoginIp) : null;
    const shouldNotifyNewAccess = previousIp !== null && previousIp !== String(ip);

    // 7) Reset contadores após login OK + salvar lastLogin
    await strapi.documents('api::auth-security.auth-security').update({
      documentId: secId,
      data: {
        failedLoginAttempts: 0,
        loginBlockedUntil: null,
        firstAccessFailedAttempts: 0,
        firstAccessBlockedUntil: null,
        lastLoginAt: now.toISOString(),
        lastLoginIp: ip,
        lastLoginUserAgent: userAgent,
      },
    });

    // 8) Registrar trusted-device (ip/user-agent)
    const existingDevice = await strapi.documents('api::trusted-device.trusted-device').findFirst({
      filters: { user: { id: userId }, ip, userAgent },
    });

    if (!existingDevice) {
      await strapi.documents('api::trusted-device.trusted-device').create({
        data: {
          user: userId,
          ip,
          userAgent,
          firstSeenAt: now,
          lastSeenAt: now,
          timesSeen: 1,
        },
      });
    } else {
      await strapi.documents('api::trusted-device.trusted-device').update({
        documentId: (existingDevice as any).documentId || (existingDevice as any).id,
        data: {
          lastSeenAt: now,
          timesSeen: Number((existingDevice as any).timesSeen || 1) + 1,
        },
      });
    }

    // 9) Enviar e-mail de alerta
    if (shouldNotifyNewAccess) {
      try {
        await sendEmail(strapi, {
          to: email,
          subject: 'Recicla+ - Novo acesso à sua conta',
          text:
            `Detectamos um novo acesso em sua conta.\n\n` +
            `Data/Hora: ${now.toISOString()}\n` +
            `IP: ${ip}\n` +
            `User-Agent: ${userAgent}\n\n` +
            `Se não foi você, altere sua senha imediatamente.`,
        });
      } catch (err) {
        strapi.log.warn(`[municipe-login] falha ao enviar alerta de novo acesso: ${String(err)}`);
      }
    }

    // 10) JWT
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const expiresIn = data.rememberMe ? '30d' : '1d';

    let jwt: string;
    try {
      jwt = jwtService.issue({ id: userId }, { expiresIn });
    } catch {
      const jsonwebtoken = await import('jsonwebtoken');
      const secret = strapi.config.get('plugin.users-permissions.jwtSecret');
      jwt = jsonwebtoken.sign({ id: userId }, secret, { expiresIn });
    }

    const isConfirmed = (user as any).confirmed === true;

    return {
      jwt,
      user: { id: userId, email: (user as any).email, role: 'Municipe' },
      expiresIn,
      requiresEmailConfirmation: !isConfirmed,
      confirmed: isConfirmed,
    };
  },
});