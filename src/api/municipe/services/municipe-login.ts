// Este arquivo trata a autenticação, segurança de IP, dispositivos confiáveis e o "Manter Conectado".

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { ZodError } from 'zod'; 
import { MunicipeLoginSchema, MunicipeLoginInput } from '../validation/MunicipeLoginSchema';
import { sendEmail } from './helpers/send-email';
import { deriveSaltFromUser } from './helpers/derive-salt';
import { BruteForceService } from '../../../services/brute-force.service';

const LOGIN_2FA_TTL_MS = 10 * 60 * 1000;

function generateLoginTwoFactorCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateChallengeId() {
  return crypto.randomUUID();
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
    const bruteForceService = new BruteForceService(strapi);

    // 1. Verificar se o identificador (email) está bloqueado
    if (await bruteForceService.isBlocked(email)) {
      return ctx.tooManyRequests('Sua conta está temporariamente bloqueada devido a muitas tentativas falhas. Tente novamente em 15 minutos.');
    }

    // Busca o usuário no plugin nativo do Strapi.
    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { email: email.toLowerCase() },
      populate: ['role'],
    });

    if (!user || !user.password) {
      await bruteForceService.recordAttempt(email, false);
      return ctx.badRequest('E-mail ou senha inválidos.');
    }

    // Compara o hash da senha.
    let validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      const userDoc = await strapi.documents('plugin::users-permissions.user').findFirst({
        filters: { id: user.id as any }
      });
      const derived = deriveSaltFromUser(userDoc);
      if (derived) {
        validPassword = await bcrypt.compare(password + '::' + derived, user.password);
      }
    }

    // 2. Registrar o resultado da tentativa de senha
    const attempt = await bruteForceService.recordAttempt(email, validPassword);

    if (!validPassword) {
      // Se houver delay progressivo configurado no serviço, o App sentirá a demora
      if (attempt.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, attempt.delayMs));
      }
      return ctx.badRequest('E-mail ou senha inválidos.');
    }

    // Garante que apenas usuários com a Role "Municipe" acessem esta rota.
    if (user.role?.name !== 'Municipe') {
      return ctx.forbidden('Acesso restrito a Municipes.');
    }

    const sec = await getOrCreateAuthSecurity(strapi, user.id);
    const ip = getClientIp(ctx);
    const userAgent = getUserAgent(ctx);
    const nowDate = new Date();
    const existingDevice = await strapi.documents('api::trusted-device.trusted-device').findFirst({
      filters: {
        user: { id: user.id as any },
        ip,
        userAgent,
      },
    });

    const skipUntilRaw = (existingDevice as any)?.twoFactorSkipUntil;
    const skipUntilMs = skipUntilRaw ? new Date(skipUntilRaw).getTime() : NaN;
    const canSkipTwoFactor = Number.isFinite(skipUntilMs) && Date.now() <= skipUntilMs;

    if (canSkipTwoFactor) {
      const rememberJwt = Boolean(rememberMe);
      const hours = rememberJwt ? 720 : 24;
      const expiresIn = rememberJwt ? '30d' : '1d';
      const tokenExpiresAt = addHours(nowDate, hours);

      const jwtService = strapi.plugin('users-permissions').service('jwt');
      const token = jwtService.issue({ id: user.id }, { expiresIn });

      await strapi.documents('api::auth-security.auth-security').update({
        documentId: String((sec as any).documentId || (sec as any).id),
        data: {
          lastLoginAt: nowDate,
          loginTwoFactorChallengeId: null,
          loginTwoFactorCode: null,
          loginTwoFactorExpiresAt: null,
          loginTwoFactorRememberMe: false,
        },
      });

      await strapi.documents('api::trusted-device.trusted-device').update({
        documentId: String((existingDevice as any).documentId || (existingDevice as any).id),
        data: {
          lastSeenAt: nowDate,
          timesSeen: Number((existingDevice as any).timesSeen || 1) + 1,
        },
      });

      return {
        requiresTwoFactor: false,
        twoFactorBypassed: true,
        jwt: token,
        user: {
          id: user.id,
          documentId: (user as any).documentId,
          username: user.username,
          email: user.email,
        },
        rememberMe: rememberJwt,
        expiresAt: tokenExpiresAt.toISOString(),
      };
    }

    const userId = user.id;
    const now = Date.now();
    const code = generateLoginTwoFactorCode();
    const challengeId = generateChallengeId();
    const expiresAt = new Date(now + LOGIN_2FA_TTL_MS);

    await strapi.documents('api::auth-security.auth-security').update({
      documentId: String((sec as any).documentId || (sec as any).id),
      data: {
        loginTwoFactorChallengeId: challengeId,
        loginTwoFactorCode: code,
        loginTwoFactorExpiresAt: expiresAt.toISOString(),
        loginTwoFactorRememberMe: Boolean(rememberMe),
      },
    });

    await sendEmail(strapi, {
      to: email,
      subject: 'Recicla+ - Codigo de verificacao de login',
      text: `Seu codigo de login e: ${code}\n\nEle expira em 10 minutos.`,
    });

    return {
      requiresTwoFactor: true,
      challengeId,
      expiresAt: expiresAt.toISOString(),
      rememberMe: Boolean(rememberMe),
    };
  },
});