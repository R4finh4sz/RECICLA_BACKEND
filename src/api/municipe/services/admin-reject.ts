export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const rawId = String(ctx.params?.id || '').trim();
    if (!rawId) return ctx.badRequest('Invalid id.');

    const adminUser = ctx.state.user;
    if (!adminUser) return ctx.unauthorized('Missing JWT.');

    const motivoArquivamento =
      ctx.request?.body?.motivoArquivamento != null
        ? String(ctx.request.body.motivoArquivamento).trim()
        : null;

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

    if (municipe.statusCadastro === 'ARQUIVADO') {
      return { rejected: true };
    }

    const updated = await strapi.documents('api::municipe.municipe').update({
      documentId: String(municipe.documentId),
      data: {
        statusCadastro: 'ARQUIVADO',
        arquivadoEm: new Date().toISOString(),
        arquivadoPor: adminUser.id,
        motivoArquivamento: motivoArquivamento || null,
      },
    });

    if (municipe.user) {
      await strapi.documents('plugin::users-permissions.user').update({
        documentId: String(municipe.user.documentId || municipe.user.id),
        data: { blocked: true },
      });
    }

    return { rejected: true, municipe: updated };
  },
});