// Service do módulo Municipe: implementa regras de negócio para autenticação do usuário e emissão de token.
// Depende de: bcrypt (validação de senha); Zod (validação de dados); Users & Permissions (usuários/roles).

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
  // Executa rotina de autenticação do usuário e emissão de token.
  if (!sec) {
    sec = await strapi.documents('api::auth-security.auth-security').create({
      data: { user: userId }
    });
  }
  return sec;
}

// Exporta o handler principal do módulo Municipe.
export default ({ strapi }: { strapi: any }) => ({
  // Executa rotina de autenticação do usuário e emissão de token.
  async execute(ctx: any) {
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

    // Busca user + role, responde neutro se não for Municipe!
    const user = await strapi.documents('plugin::users-permissions.user').findFirst({
      filters: { email },
      fields: ['id', 'email', 'password', 'blocked', 'confirmed'],
      populate: { role: { fields: ['name'] } },
    });
    const genericError = () => ctx.badRequest('Credenciais inválidas.');
    if (!user || (user as any).role?.name !== 'Municipe') return genericError();
    if ((user as any).blocked === true) return genericError();
    if ((user as any).confirmed !== true) return genericError();

    const userId = (user as any).id;
    // Onboarding info
    const fac = await strapi.documents('api::first-access-control.first-access-control').findFirst({
      filters: { user: { id: userId as any } },
    });

    // Controle de login -- tentativas e bloqueios
    const sec = await getOrCreateAuthSecurity(strapi, userId);
    const secId = String((sec as any).documentId || (sec as any).id);
    const now = new Date();
    const isFirstAccess = Boolean(fac && (fac as any).mustChangePassword);

    const blockedUntil = isFirstAccess ? sec.firstAccessBlockedUntil : sec.loginBlockedUntil;
    if (blockedUntil && new Date(blockedUntil).getTime() > now.getTime()) {
      return genericError();
    }

    // Valida senha
    const hashed = (user as any).password;
    if (!hashed) return genericError();
    const ok = await bcrypt.compare(data.password, hashed);

    // Executa rotina de autenticação do usuário e emissão de token.
    if (!ok) {
      // Executa rotina de autenticação do usuário e emissão de token.
      if (isFirstAccess) {
        const next = Number(sec.firstAccessFailedAttempts || 0) + 1;
        const updateData: any = { firstAccessFailedAttempts: next };
        // 5 tentativas → bloqueia por 1 hora
        if (next >= 5) {
          updateData.firstAccessBlockedUntil = addHours(now, 1).toISOString();
          updateData.firstAccessFailedAttempts = 0;
        }
        await strapi.documents('api::auth-security.auth-security').update({ documentId: secId, data: updateData });
      } else {
        const next = Number(sec.failedLoginAttempts || 0) + 1;
        const updateData: any = { failedLoginAttempts: next };
        // 5 tentativas → bloqueia por 15 min
        if (next >= 5) {
          updateData.loginBlockedUntil = addMinutes(now, 15).toISOString();
          updateData.failedLoginAttempts = 0;
        }
        await strapi.documents('api::auth-security.auth-security').update({ documentId: secId, data: updateData });
      }
      return genericError();
    }

    // Resetar contadores após login OK
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
      }
    });

    // Registrar trusted-device (ip/user-agent) - AJUSTADO PARA UNIVERSAL
    const existingDevice = await strapi.documents('api::trusted-device.trusted-device').findFirst({
      filters: { user: { id: userId }, ip, userAgent }
    });

    // Executa rotina de autenticação do usuário e emissão de token.
    if (!existingDevice) {
      await strapi.documents('api::trusted-device.trusted-device').create({
        data: {
          user: userId,
          ip,
          userAgent,
          firstSeenAt: now,
          lastSeenAt: now,
          timesSeen: 1,
        }
      });
    } else {
      await strapi.documents('api::trusted-device.trusted-device').update({
        documentId: existingDevice.documentId || existingDevice.id,
        data: {
          lastSeenAt: now,
          timesSeen: Number(existingDevice.timesSeen || 1) + 1,
        }
      });
    }

    // Notificar somente se IP for diferente do anterior!
    if (sec.lastLoginIp && String(sec.lastLoginIp) !== String(ip)) {
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
    }

    // JWT
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

    return {
      jwt,
      user: { id: userId, email: (user as any).email, role: 'Municipe' },
      expiresIn,
    };
  }
});