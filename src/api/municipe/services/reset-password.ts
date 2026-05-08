import { z, ZodError } from 'zod';
import { ResetPasswordSchema, type ResetPasswordInput } from '../validation/ResetPasswordSchema';
import { hashPassword } from '../../../utils/password-hash';

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let data: ResetPasswordInput;

    try {
      data = ResetPasswordSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) {
        ctx.status = 400;
        ctx.body = {
          error: 'Dados inválidos.',
          details: err.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        };
        return;
      }
      throw err;
    }

    const { resetToken, newPassword } = data;

    const now = new Date();
    const fac = await strapi.documents('api::first-access-control.first-access-control').findFirst({
      filters: { passwordResetToken: resetToken },
      populate: ['user'],
    });

    if (!fac) return ctx.badRequest('Token inválido ou expirado.');

    const tokenExpiresAt = fac.passwordResetTokenExpiresAt ? new Date(fac.passwordResetTokenExpiresAt) : null;
    const usedAt = (fac as any).passwordResetUsedAt;
    if (!tokenExpiresAt || tokenExpiresAt < now || usedAt) return ctx.badRequest('Token inválido ou expirado.');

    const userRef = (fac as any).user;
    const userId = userRef?.id ?? userRef ?? null;
    if (!userId) return ctx.badRequest('Dados do usuário inválidos.');

    const passwordHash = await hashPassword(newPassword);
    await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: userId as any },
      data: { password: passwordHash },
    });

    await strapi.documents('api::first-access-control.first-access-control').update({
      documentId: String(fac.documentId || fac.id),
      data: {
        passwordResetUsedAt: now.toISOString(),
        passwordResetCode: null,
        passwordResetExpiresAt: null,
        passwordResetRequestedAt: null,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        passwordResetValidatedAt: null,
      },
    });

    return { success: true, message: 'Senha alterada com sucesso.' };
  },
});