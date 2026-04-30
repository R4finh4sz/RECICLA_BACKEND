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
    const termoDocumentId = String((termo as any).documentId || (termo as any).id || "");
    const termoVersion = String((termo as any).version || "sem-versao");

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
        acceptedTermDocumentId: termoDocumentId,
      },
    });

    let fac = await strapi
      .documents("api::first-access-control.first-access-control")
      .findFirst({
        filters: { user: { id: userId as any } },
        fields: ["documentId", "id"],
      });

    if (!fac) {
      fac = await strapi
        .documents("api::first-access-control.first-access-control")
        .create({
          data: {
            user: userId,
            mustCompleteProfile: false,
            mustAcceptTerms: false,
            mustChangePassword: false,
            termsAcceptedAt: acceptedAt,
            termsVersionAccepted: termoVersion,
            termsAcceptedTermDocumentId: termoDocumentId,
          },
        });
    } else {
      await strapi
        .documents("api::first-access-control.first-access-control")
        .update({
          documentId: String((fac as any).documentId || (fac as any).id),
          data: {
            mustAcceptTerms: false,
            termsAcceptedAt: acceptedAt,
            termsVersionAccepted: termoVersion,
            termsAcceptedTermDocumentId: termoDocumentId,
          },
        });
    }

    await strapi.documents("api::term-list.term-list").create({
      data: {
        user: userId,
        termo: (termo as any).id || undefined,
        version: termoVersion,
        termDocumentId: termoDocumentId,
        acceptedAt,
      },
    });

    strapi.log.info(
      `[terms-consent] aceite registrado userId=${userId} version=${termoVersion} termDocumentId=${termoDocumentId}`,
    );

    return {
      success: true,
      message: "Termos aceitos com sucesso!",
      acceptedAt,
    };
  },
});
