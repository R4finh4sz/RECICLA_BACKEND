// Valida o código de redefinição enviado por e-mail e retorna um resetToken temporário.
// Entrada esperada: { email: string, code: string }
// Retorna: { resetToken: string, expiresAt: ISOString }

import crypto from 'node:crypto';
import { z, ZodError } from 'zod';

const ValidateResetCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Código deve ter 6 dígitos'),
});

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let payload: { email: string; code: string };
    try {
      payload = ValidateResetCodeSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) return ctx.badRequest('Body inválido. Envie { email, code }.');
      throw err;
    }

    const email = payload.email.trim().toLowerCase();
    const code = String(payload.code).trim();

    // 1) Localiza usuário pelo e-mail
    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { email },
    });
    if (!user) return ctx.badRequest('Código inválido ou expirado.');

    const userId = (user as any).id;

    // 2) Localiza o first-access-control do usuário
    const fac = await strapi.documents('api::first-access-control.first-access-control').findFirst({
      filters: { user: { id: userId } },
    });

    if (!fac || !fac.passwordResetCode) {
      return ctx.badRequest('Código inválido ou expirado.');
    }

    const now = new Date();
    const expiresAt = fac.passwordResetExpiresAt ? new Date(fac.passwordResetExpiresAt) : null;
    const usedAt = (fac as any).passwordResetUsedAt;
    if (!expiresAt || expiresAt < now || usedAt) return ctx.badRequest('Código inválido ou expirado.');

    if (String(fac.passwordResetCode) !== code) return ctx.badRequest('Código inválido ou expirado.');

    // 3) Código válido: gere um resetToken temporário e salve no FAC
    const resetToken = crypto.randomUUID();
    const tokenTtlMinutes = 15;
    const tokenExpiresAt = new Date(now.getTime() + tokenTtlMinutes * 60 * 1000).toISOString();

    await strapi.documents('api::first-access-control.first-access-control').update({
      documentId: String(fac.documentId || fac.id),
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpiresAt: tokenExpiresAt,
        passwordResetValidatedAt: now.toISOString(),
      },
    });

    // Retorna o token (app usará esse token para enviar a nova senha)
    return { resetToken, expiresAt: tokenExpiresAt };
  },
});