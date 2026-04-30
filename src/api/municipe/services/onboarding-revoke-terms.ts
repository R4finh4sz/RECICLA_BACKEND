import { getUserRoleName } from "./helpers/get-user-role-name";

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized("Token invalido ou ausente.");

    const roleName = getUserRoleName(ctx);
    if (roleName !== "Municipe") return ctx.forbidden("Apenas Municipe.");

    const municipe = await strapi
      .documents("api::municipe.municipe")
      .findFirst({
        filters: { user: { id: userId } },
        fields: ["documentId", "id"],
      });

    if (!municipe) return ctx.notFound("Municipe nao encontrado.");

    await strapi.documents("api::municipe.municipe").update({
      documentId: String((municipe as any).documentId || (municipe as any).id),
      data: {
        acceptedTerms: false,
        acceptedAt: null,
        acceptedTermDocumentId: null,
      },
    });

    const fac = await strapi
      .documents("api::first-access-control.first-access-control")
      .findFirst({
        filters: { user: { id: userId } },
        fields: ["documentId", "id"],
      });

    if (fac) {
      await strapi
        .documents("api::first-access-control.first-access-control")
        .update({
          documentId: String((fac as any).documentId || (fac as any).id),
          data: {
            mustAcceptTerms: true,
            termsAcceptedAt: null,
            termsVersionAccepted: null,
            termsAcceptedTermDocumentId: null,
          },
        });
    }

    strapi.log.warn(`[terms-consent] revogacao registrada userId=${userId}`);

    return {
      success: true,
      revokedAt: new Date().toISOString(),
      mustAcceptTerms: true,
    };
  },
});
