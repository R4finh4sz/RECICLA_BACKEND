export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const rawId = String(ctx.params?.id || '').trim();
    if (!rawId) return ctx.badRequest('Invalid id.');

    const adminUser = ctx.state.user;
    if (!adminUser) return ctx.unauthorized('Missing JWT.');

    const isNumericId = /^[0-9]+$/.test(rawId);

    const municipe = isNumericId
      ? await strapi.db.query('api::municipe.municipe').findOne({
          where: { id: Number(rawId) },
          populate: { user: true },
        })
      : await strapi.db.query('api::municipe.municipe').findOne({
          where: { documentId: rawId },
          populate: { user: true },
        });

    if (!municipe) return ctx.notFound('Municipe not found.');

    if (municipe.statusCadastro !== 'AGUARDANDO_VALIDACAO') {
      return ctx.badRequest('Municipe is not pending approval.');
    }

    const updated = await strapi.documents('api::municipe.municipe').update({
      documentId: String(municipe.documentId),
      data: {
        statusCadastro: 'ATIVO',
        validadoEm: new Date().toISOString(),
        arquivadoEm: null,
        motivoArquivamento: null,
        validadoPor: adminUser.id,
        arquivadoPor: null,
      },
    });

    if (municipe.user) {
      await strapi.documents('plugin::users-permissions.user').update({
        documentId: String(municipe.user.documentId || municipe.user.id),
        data: { blocked: false },
      });
    }

    return { approved: true, municipe: updated };
  },
});