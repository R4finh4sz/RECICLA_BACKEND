// Este arquivo trata a autenticação, segurança de IP, dispositivos confiáveis e o "Manter Conectado".

import bcrypt from 'bcryptjs';
import { ZodError } from 'zod'; 
import { MunicipeLoginSchema, MunicipeLoginInput } from '../validation/MunicipeLoginSchema';
import { sendEmail } from './helpers/send-email';

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
    // Validação de entrada com tratamento de erro específico do Zod.
    let data: MunicipeLoginInput;
    try {
      data = MunicipeLoginSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) {
        return ctx.badRequest('Dados de login inválidos.', { details: err.issues });
      }
      throw err;
    }

    const { email, password, rememberMe } = data;

    // Busca o usuário no plugin nativo do Strapi.
    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { email: email.toLowerCase() },
      populate: ['role'],
    });

    if (!user || !user.password) {
      return ctx.badRequest('E-mail ou senha inválidos.');
    }

    // Compara o hash da senha.
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return ctx.badRequest('E-mail ou senha inválidos.');
    }

    // Garante que apenas usuários com a Role "Municipe" acessem esta rota.
    if (user.role?.name !== 'Municipe') {
      return ctx.forbidden('Acesso restrito a Municipes.');
    }

    const userId = user.id;
    const ip = getClientIp(ctx);
    const userAgent = getUserAgent(ctx);
    const now = new Date();

    // Lógica de auditoria e segurança (AuthSecurity).
    const sec = await getOrCreateAuthSecurity(strapi, userId);

    // Registro de dispositivo confiável.
    const existingDevice = await strapi.documents('api::trusted-device.trusted-device').findFirst({
      filters: {
        user: { id: userId as any },
        ip,
        userAgent,
      },
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

    // Alerta de novo IP.
    if ((sec as any).lastLoginIp && String((sec as any).lastLoginIp) !== String(ip)) {
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

    // --- Lógica de Manter Conectado ---
    // Calculamos o tempo de expiração: 30 dias se marcar rememberMe, se não 1 dia.
    const hours = rememberMe ? 720 : 24;
    const expiresIn = rememberMe ? '30d' : '1d';
    const expiresAt = addHours(now, hours);

    // Persistência dos dados de expiração para auditoria no banco.
    await strapi.documents('api::auth-security.auth-security').update({
      documentId: (sec as any).documentId,
      data: {
        lastLoginAt: now,
        lastLoginIp: ip,
        tokenExpiresAt: expiresAt, 
      },
    });

    // Emissão do token JWT customizado.
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const token = jwtService.issue({ id: userId }, { expiresIn });

    return {
      jwt: token,
      user: {
        id: user.id,
        documentId: user.documentId,
        username: user.username,
        email: user.email,
      },
      rememberMe,
      expiresAt: expiresAt.toISOString()
    };
  },
});