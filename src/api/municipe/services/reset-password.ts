// Service do módulo municipe: implementa regras de negócio para gestão do perfil e dados do municipe.
// Depende de: Zod (validação de dados); Users & Permissions (usuários/roles); document API do Strapi.

import { ZodError } from 'zod';
import { ResetPasswordSchema, type ResetPasswordInput } from '../validation/ResetPasswordSchema';

function isExpired(expiresAt: string | Date) {
  const d = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return d.getTime() <= Date.now();
}

// Exporta o handler principal do módulo municipe.
export default ({ strapi }: { strapi: any }) => ({
  // Executa rotina de gestão do perfil e dados do municipe.
  async execute(ctx: any) {
    let data: ResetPasswordInput;
    try {
      data = ResetPasswordSchema.parse(ctx.request.body || {});
    } catch (err) {
      // Executa rotina de gestão do perfil e dados do municipe.
      if (err instanceof ZodError) {
        ctx.status = 400;
        ctx.body = {
          error: "Senha inválida.",
          details: err.issues.map(issue => ({
            path: issue.path,
            message: issue.message
          }))
        };
        return;
      }
      throw err;
    }

    const email = data.email.trim().toLowerCase();

    const user = await strapi.documents('plugin::users-permissions.user').findFirst({
      filters: { email },
      fields: ['id', 'email'],
      populate: { role: { fields: ['name'] } },
    });

    if (!user) return ctx.badRequest('Código inválido ou expirado.');
    const roleName = (user as any).role?.name || (user as any).role;
    if (roleName !== 'Municipe') return ctx.badRequest('Código inválido ou expirado.');

    const fac = await strapi
      .documents('api::first-access-control.first-access-control')
      .findFirst({ filters: { user: { id: (user as any).id } } });

    if (!fac) return ctx.badRequest('Código inválido ou expirado.');

    const storedCode = (fac as any).passwordResetCode;
    const expiresAt = (fac as any).passwordResetExpiresAt;
    const usedAt = (fac as any).passwordResetUsedAt;

    if (!storedCode || !expiresAt || usedAt) return ctx.badRequest('Código inválido ou expirado.');
    if (String(storedCode) !== String(data.code)) return ctx.badRequest('Código inválido ou expirado.');
    if (isExpired(expiresAt)) return ctx.badRequest('Código inválido ou expirado.');

    // atualiza senha do usuário
    const userService = strapi.plugin('users-permissions').service('user') as any;
    const updateUser = userService.update?.bind(userService) || userService.edit?.bind(userService);
    if (!updateUser) return ctx.badRequest('Service users-permissions.user não expõe update/edit.');

    await updateUser((user as any).id, { password: data.newPassword });

    // invalida o código
    const facId = String((fac as any).documentId || (fac as any).id);
    await strapi.documents('api::first-access-control.first-access-control').update({
      documentId: facId,
      data: {
        passwordResetUsedAt: new Date().toISOString(),
        passwordResetCode: null,
        passwordResetExpiresAt: null,
      },
    });

    return { reset: true };
  },
});