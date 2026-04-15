// Este service trata o aceite de termos pelo usuário do tipo Municipe de forma simples.
import { getUserRoleName } from "./helpers/get-user-role-name";

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized("Token inválido ou ausente.");

    const roleName = getUserRoleName(ctx);
    if (roleName !== "Municipe") return ctx.forbidden("Apenas Municipe.");

    // Busca o termo mais recente
    const termo = await strapi.service("api::termo.get-active-termo").execute();
    if (!termo) return ctx.badRequest("Nenhum termo disponível para aceite.");

    const acceptedAt = new Date().toISOString();

    // Atualiza o Municipe com a data e o ID do termo aceito
    const municipe = await strapi
      .documents("api::municipe.municipe")
      .findFirst({
        filters: { user: { id: userId } },
        fields: ["documentId"],
      });

    if (!municipe) return ctx.notFound("Municipe não encontrado.");

    await strapi.documents("api::municipe.municipe").update({
      documentId: municipe.documentId,
      data: {
        acceptedTerms: true,
        acceptedAt,
        acceptedTermDocumentId: termo.documentId,
      },
    });

    return {
      success: true,
      message: "Termos aceitos com sucesso!",
      acceptedAt,
    };
  },
});
