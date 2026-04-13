import crypto from 'node:crypto';
import { ZodError } from 'zod';
import { LoginTwoFactorResendSchema, type LoginTwoFactorResendInput } from '../validation/LoginTwoFactorResendSchema';
import { sendEmail } from './helpers/send-email';

function generateLoginTwoFactorCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let payload: LoginTwoFactorResendInput;
    try {
      payload = LoginTwoFactorResendSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) return ctx.badRequest('Solicitacao invalida.');
      throw err;
    }

    const email = payload.email.trim().toLowerCase();

    const user = await strapi.documents('plugin::users-permissions.user').findFirst({
      filters: { email },
      fields: ['id', 'email'],
      populate: { role: { fields: ['name'] } },
    });

    if (!user) return { sent: true };
    const roleName = (user as any).role?.name || (user as any).role;
    if (roleName !== 'Municipe') return { sent: true };

    const security = await strapi.documents('api::auth-security.auth-security').findFirst({
      filters: { user: { id: (user as any).id } },
    });

    if (!security || !(security as any).loginTwoFactorChallengeId || !(security as any).loginTwoFactorCode) {
      return ctx.badRequest('Sessao de autenticacao expirada. Faca login novamente.');
    }

    if (String((security as any).loginTwoFactorChallengeId) !== payload.challengeId) {
      return ctx.badRequest('Sessao de autenticacao expirada. Faca login novamente.');
    }

    const now = Date.now();

    const expiresAtMs = new Date((security as any).loginTwoFactorExpiresAt).getTime();
    if (!Number.isFinite(expiresAtMs) || now > expiresAtMs) {
      return ctx.badRequest('Sessao de autenticacao expirada. Faca login novamente.');
    }

    const code = generateLoginTwoFactorCode();
    const expiresAt = new Date(now + 10 * 60 * 1000);

    await strapi.documents('api::auth-security.auth-security').update({
      documentId: String((security as any).documentId || (security as any).id),
      data: {
        loginTwoFactorCode: code,
        loginTwoFactorExpiresAt: expiresAt.toISOString(),
      },
    });

    await sendEmail(strapi, {
      to: email,
      subject: 'Recicla+ - Reenvio do codigo de verificacao de login',
      text: `Seu novo codigo de login e: ${code}\n\nEle expira em 10 minutos.`,
    });

    return {
      sent: true,
      expiresAt: expiresAt.toISOString(),
    };
  },
});
