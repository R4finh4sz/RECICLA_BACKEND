import { ZodError } from 'zod';
import { ConfirmEmailCodeSchema, type ConfirmEmailCodeInput } from '../validation/ConfirmEmailCodeSchema';
import { parseEmailConfirmationToken } from './helpers/email-confirmation-code';

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let payload: ConfirmEmailCodeInput;

    try {
      payload = ConfirmEmailCodeSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) return ctx.badRequest('Dados inválidos.');
      throw err;
    }

    const email = payload.email.trim().toLowerCase();

    const user = await strapi.documents('plugin::users-permissions.user').findFirst({
      filters: { email },
      fields: ['id', 'documentId', 'email', 'confirmed', 'confirmationToken'],
      populate: { role: { fields: ['name'] } },
    });

    if (!user) return ctx.badRequest('Código inválido ou expirado.');

    const roleName = (user as any).role?.name || (user as any).role;
    if (roleName !== 'Municipe') return ctx.badRequest('Código inválido ou expirado.');

    if ((user as any).confirmed === true) {
      return { confirmed: true };
    }

    const parsed = parseEmailConfirmationToken((user as any).confirmationToken);
    if (!parsed) return ctx.badRequest('Código inválido ou expirado.');

    if (parsed.code !== payload.code) return ctx.badRequest('Código inválido ou expirado.');
    if (Date.now() > parsed.expiresAt) return ctx.badRequest('Código inválido ou expirado.');

    await strapi.documents('plugin::users-permissions.user').update({
      documentId: String((user as any).documentId || (user as any).id),
      data: {
        confirmed: true,
        confirmationToken: null,
      },
    });

    return { confirmed: true };
  },
});
