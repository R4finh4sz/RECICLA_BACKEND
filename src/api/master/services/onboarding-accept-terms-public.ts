export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const termo = await strapi.service("api::termo.get-active-termo").execute();
    if (!termo)
      return ctx.badRequest("Nenhum termo ativo disponível para aceite.");

    return {
      success: true,
      message: "Termo válido para aceite no cadastro.",
      termo: {
        title: (termo as any).title,
        documentId: (termo as any).documentId,
      },
    };
  },
});
