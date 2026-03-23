import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::termo.termo', ({ strapi }) => ({
  async getActive(ctx) {
    const svc = strapi.service('api::termo.get-active-termo');
    if (!svc) return ctx.internalServerError('Service não registrado.');
    
    const result = await svc.execute();
    if (!result) return ctx.notFound('Nenhum termo ativo encontrado.');
    
    return { data: result };
  },

  async downloadActivePdf(ctx) {
    const svc = strapi.service('api::termo.download-active-termo-pdf');
    if (!svc) return ctx.internalServerError('Service não registrado.');
    
    return svc.execute(ctx);
  },
}));