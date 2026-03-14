// Service do módulo municipe: implementa regras de negócio para gestão do perfil e dados do municipe.
// Depende de: document API do Strapi.

import { getUserRoleName } from './helpers/get-user-role-name';
import { pickAllowedMunicipeUpdate } from './helpers/pick-allowed-municipe-update';

// Exporta o handler principal do módulo municipe.
export default ({ strapi }: { strapi: any }) => ({
  // Executa rotina de gestão do perfil e dados do municipe.
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized('Token inválido ou ausente.');

    const roleName = getUserRoleName(ctx);
    if (roleName !== 'Municipe') return ctx.forbidden('Apenas Municipe.');

    // Bloqueios rígidos
    if (ctx?.request?.body?.nome !== undefined) return ctx.badRequest('Não é permitido alterar o nome.');
    if (ctx?.request?.body?.cpf !== undefined) return ctx.badRequest('Não é permitido alterar o CPF.');
    if (ctx?.request?.body?.email !== undefined) return ctx.badRequest('Não é permitido alterar o e-mail.');
    if (ctx?.request?.body?.user !== undefined) return ctx.badRequest('Não é permitido alterar o vínculo de usuário.');

    const municipe = await strapi.documents('api::municipe.municipe').findFirst({
      filters: { user: { id: userId as any } },
      fields: ['id', 'documentId'],
    });

    if (!municipe) return ctx.notFound('Municipe não encontrado.');

    const updateData = pickAllowedMunicipeUpdate(ctx.request.body || {});
    if (Object.keys(updateData).length === 0) {
      return ctx.badRequest('Nenhum campo permitido para atualização foi enviado.');
    }

    const updated = await strapi.documents('api::municipe.municipe').update({
      documentId: String((municipe as any).documentId || (municipe as any).id),
      data: updateData,
    });

    const isComplete =
      Boolean((updated as any)?.endereco) &&
      Boolean((updated as any)?.cep) &&
      Boolean((updated as any)?.cidade) &&
      Boolean((updated as any)?.telefone);

    const fac = await strapi.documents('api::first-access-control.first-access-control').findFirst({
      filters: { user: { id: userId as any } },
      fields: ['id', 'documentId'],
    });

    if (fac) {
      await strapi.documents('api::first-access-control.first-access-control').update({
        documentId: String((fac as any).documentId || (fac as any).id),
        data: {
          mustCompleteProfile: !isComplete,
          profileCompletedAt: isComplete ? new Date().toISOString() : null,
          mustChangePassword: false,
          tempPasswordExpiresAt: null,
          tempPasswordIssuedAt: null,
          tempPasswordUsedAt: null,
        },
      });
    } else {
      await strapi.documents('api::first-access-control.first-access-control').create({
        data: {
          user: userId,
          mustCompleteProfile: !isComplete,
          profileCompletedAt: isComplete ? new Date().toISOString() : null,
          mustAcceptTerms: true,
          mustChangePassword: false,
          tempPasswordExpiresAt: new Date().toISOString(),
        },
      });
    }

    return updated;
  }
});