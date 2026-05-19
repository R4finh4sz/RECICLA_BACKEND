import { getUserRoleName } from "./helpers/get-user-role-name";

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized("Token invalido ou ausente.");

    const roleName = await getUserRoleName(ctx, strapi);
    if (roleName !== "Municipe") return ctx.forbidden("Apenas Municipe.");

    const municipe = await strapi
      .documents("api::municipe.municipe")
      .findFirst({
        filters: { user: { id: userId } },
        fields: ["documentId", "id", "acceptedTermDocumentId"],
      });

    if (!municipe) return ctx.notFound("Municipe nao encontrado.");

    const fac = await strapi
      .documents("api::first-access-control.first-access-control")
      .findFirst({
        filters: { user: { id: userId } },
        fields: ["documentId", "id", "termsAcceptedTermDocumentId", "mustAcceptTerms"],
      });

    const termDocumentIdToRevoke =
      ((fac as any)?.termsAcceptedTermDocumentId as any) ||
      ((municipe as any).acceptedTermDocumentId as any);

    if (!termDocumentIdToRevoke || (fac as any)?.mustAcceptTerms) {
      return ctx.badRequest("Consentimento já revogado para este termo.");
    }

    const activeAcceptance = await strapi
      .documents("api::term-list.term-list")
      .findFirst({
        filters: {
          user: { id: userId as any },
          termDocumentId: termDocumentIdToRevoke,
          revoked: false,
        },
        fields: ["documentId", "id"],
      });

    if (!activeAcceptance) {
      return ctx.badRequest("Consentimento já revogado para este termo.");
    }

    await strapi.documents("api::municipe.municipe").update({
      documentId: String((municipe as any).documentId || (municipe as any).id),
      data: {
        acceptedTerms: false,
        acceptedAt: null,
        acceptedTermDocumentId: null,
      },
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

    // Marca o(s) registro(s) em term-list como revogados para impedir acesso
    // e permitir aceitação somente após atualização do termo.
    const existing = await strapi
      .documents("api::term-list.term-list")
      .findMany({
        filters: { user: { id: userId as any }, termDocumentId: termDocumentIdToRevoke },
        fields: ["documentId", "id"],
      });

    for (const rec of existing || []) {
      await strapi.documents("api::term-list.term-list").update({
        documentId: String((rec as any).documentId || (rec as any).id),
        data: { revoked: true },
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
