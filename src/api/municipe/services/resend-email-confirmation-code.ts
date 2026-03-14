import { ZodError } from 'zod';
import {
  ResendEmailConfirmationCodeSchema,
  type ResendEmailConfirmationCodeInput,
} from '../validation/ResendEmailConfirmationCodeSchema';
import { sendEmail } from './helpers/send-email';
import {
  buildEmailConfirmationToken,
  generateEmailConfirmationCode,
} from './helpers/email-confirmation-code';

function rateLimitResponse(ctx: any, message: string, retryAfterSeconds: number) {
  ctx.status = 429;
  ctx.body = {
    error: message,
    retryAfterSeconds,
  };
  return;
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let payload: ResendEmailConfirmationCodeInput;
    try {
      payload = ResendEmailConfirmationCodeSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) return ctx.badRequest('Solicitação inválida.');
      throw err;
    }

    const email = payload.email.trim().toLowerCase();

    const user = await strapi.documents('plugin::users-permissions.user').findFirst({
      filters: { email },
      fields: ['id', 'documentId', 'email', 'confirmed'],
      populate: { role: { fields: ['name'] } },
    });

    if (!user) return { sent: true };
    const roleName = (user as any).role?.name || (user as any).role;
    if (roleName !== 'Municipe') return { sent: true };
    if ((user as any).confirmed === true) return { sent: true };

    const userId = (user as any).id;

    const security =
      (await strapi.documents('api::auth-security.auth-security').findFirst({
        filters: { user: { id: userId } },
      })) ||
      (await strapi.documents('api::auth-security.auth-security').create({ data: { user: userId } }));

    const now = Date.now();

    const lastSentAtValue = (security as any).emailConfirmationLastSentAt;
    if (lastSentAtValue) {
      const lastSentAt = new Date(lastSentAtValue).getTime();
      const minIntervalMs = 5 * 60 * 1000;
      const elapsed = now - lastSentAt;
      if (elapsed < minIntervalMs) {
        return rateLimitResponse(
          ctx,
          'Aguarde antes de reenviar o código.',
          Math.ceil((minIntervalMs - elapsed) / 1000)
        );
      }
    }

    const windowStartValue = (security as any).emailConfirmationResendWindowStart;
    const windowStart = windowStartValue ? new Date(windowStartValue).getTime() : null;
    let count = Number((security as any).emailConfirmationResendCount || 0);

    const oneHourMs = 60 * 60 * 1000;
    if (!windowStart || now - windowStart >= oneHourMs) {
      count = 0;
    }

    if (count >= 3) {
      const retryAfterSeconds = windowStart
        ? Math.max(1, Math.ceil((oneHourMs - (now - windowStart)) / 1000))
        : 3600;
      return rateLimitResponse(ctx, 'Limite de reenvio atingido. Tente novamente mais tarde.', retryAfterSeconds);
    }

    const confirmationCode = generateEmailConfirmationCode();
    const confirmationToken = buildEmailConfirmationToken(confirmationCode, now);

    await strapi.documents('plugin::users-permissions.user').update({
      documentId: String((user as any).documentId || (user as any).id),
      data: { confirmationToken },
    });

    await strapi.documents('api::auth-security.auth-security').update({
      documentId: String((security as any).documentId || (security as any).id),
      data: {
        emailConfirmationResendCount: count + 1,
        emailConfirmationResendWindowStart: windowStart ? new Date(windowStart).toISOString() : new Date(now).toISOString(),
        emailConfirmationLastSentAt: new Date(now).toISOString(),
      },
    });

    await sendEmail(strapi, {
      to: email,
      subject: 'Recicla+ - Reenvio do código de confirmação',
      text:
        `Seu novo código de confirmação é: ${confirmationCode}\n\n` +
        `Ele expira em 10 minutos.`,
    });

    return { sent: true };
  },
});
