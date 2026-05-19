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

    // Invalida tokens: atualiza auth-security.tokenInvalidBefore e revoga token atual
    try {
      const now = new Date().toISOString();
      const authSec = await strapi.documents('api::auth-security.auth-security').findFirst({
        filters: { user: { id: userId as any } },
      });

      if (authSec) {
        await strapi.documents('api::auth-security.auth-security').update({
          documentId: String((authSec as any).documentId || (authSec as any).id),
          data: { tokenInvalidBefore: now },
        });
      } else {
        await strapi.documents('api::auth-security.auth-security').create({
          data: { user: userId, tokenInvalidBefore: now },
        });
      }

      const authHeader = String(ctx?.request?.header?.authorization || '');
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token) {
          const { TokenRevocationService } = await import('./token-revocation.service.js');
          const revocationService = new TokenRevocationService(strapi);
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 2);
          await revocationService.revoke(token, expiresAt);
        }
      }
    } catch (err) {
      strapi.log.error('[reset-password] falha ao invalidar tokens apos reset de senha', err);
    }

    return { success: true, message: 'Senha alterada com sucesso.' };
  },
});