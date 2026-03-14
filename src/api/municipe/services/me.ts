// Service do módulo Municipe: implementa regras de negócio para gestão do perfil e dados do Municipe.
// Depende de: document API do Strapi.

import { getUserRoleName } from './helpers/get-user-role-name';

// Exporta o handler principal do módulo Municipe.
export default ({ strapi }: { strapi: any }) => ({
  // Executa rotina de gestão do perfil e dados do Municipe
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized('Token inválido ou ausente.');

    const roleName = getUserRoleName(ctx);
    if (roleName !== 'Municipe') return ctx.forbidden('Apenas Municipe.');

    const municipe = await strapi.documents('api::municipe.municipe').findFirst({
      filters: { user: { id: userId as any } },
    });

    if (!municipe) return ctx.notFound('Municipe não encontrado.');
    return municipe;
  },
});