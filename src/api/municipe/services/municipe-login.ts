// Este arquivo trata a autenticação, proteção contra brute-force e fluxo de 2FA.

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { ZodError } from 'zod';
import { MunicipeLoginSchema, MunicipeLoginInput } from '../validation/MunicipeLoginSchema';
import { deriveSaltFromUser } from './helpers/derive-salt';
import { BruteForceService } from './brute-force.service';
import { sendEmail } from './helpers/send-email';

const LOGIN_2FA_TTL_MS = 10 * 60 * 1000;

function generateLoginTwoFactorCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateChallengeId() {
  return crypto.randomUUID();
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
      if (attempt.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, attempt.delayMs));
      }
      return ctx.badRequest('E-mail ou senha inválidos.');
    }
    const sec = await getOrCreateAuthSecurity(strapi, user.id);

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

    try {
      await sendEmail(strapi, {
        to: String((user as any).email || email).toLowerCase(),
        subject: 'Recicla+ - Codigo de verificacao de login',
        text:
          `Seu codigo de verificacao e: ${code}\n\n` +
          `Ele expira em 10 minutos.`,
      });
    } catch (err: any) {
      strapi.log.error(`[municipe-login] falha ao enviar codigo 2FA por email: ${String(err?.message || err)}`);
      return ctx.internalServerError('Nao foi possivel enviar o codigo de verificacao por email.');
    }

    return {
      requiresTwoFactor: true,
      challengeId,
      expiresAt: expiresAt.toISOString(),
      rememberMe: Boolean(rememberMe),
      user: {
        role: user.role ? {
          id: user.role.id,
        } : null,
      },
    };
  },
});