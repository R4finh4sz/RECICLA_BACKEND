export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const page = Math.max(1, Number(ctx.query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(ctx.query?.pageSize || 25)));

    const rows = await strapi.documents('api::municipe.municipe').findMany({
      filters: { statusCadastro: { $eq: 'AGUARDANDO_VALIDACAO' } },
      sort: { createdAt: 'asc' },
      fields: ['id', 'documentId', 'nome', 'cpf', 'cidade', 'estado', 'createdAt', 'statusCadastro'],
      populate: { user: { fields: ['id', 'email', 'confirmed', 'blocked'] } },
      page,
      pageSize,
    });

    return rows;
  },
});