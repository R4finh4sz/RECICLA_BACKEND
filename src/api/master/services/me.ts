// Service do módulo Master: implementa regras de negócio para gestão do perfil e dados do Master.
// Depende de: document API do Strapi.

import { getUserRoleName } from './helpers/get-user-role-name';

// Exporta o handler principal do módulo Master.
export default ({ strapi }: { strapi: any }) => ({
  // Executa rotina de gestão do perfil e dados do Master
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized('Token inválido ou ausente.');

    const roleName = getUserRoleName(ctx);
    if (roleName !== 'Master') return ctx.forbidden('Apenas Master.');

    const master = await strapi.documents('api::master.master').findFirst({
      filters: { user: { id: userId as any } },
    });

    if (!master) return ctx.notFound('Master não encontrado.');
    return master;
  },
});