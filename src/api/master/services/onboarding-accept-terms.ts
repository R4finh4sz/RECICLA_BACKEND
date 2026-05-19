// Este service trata o aceite de termos pelo usuário do tipo Master de forma simples.
import { getUserRoleName } from "./helpers/get-user-role-name";

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized("Token inválido ou ausente.");

    const roleName = getUserRoleName(ctx);
    if (roleName !== "Master") return ctx.forbidden("Apenas Master.");

    // Busca o termo mais recente
    const termo = await strapi.service("api::termo.get-active-termo").execute();
    if (!termo) return ctx.badRequest("Nenhum termo disponível para aceite.");

    const acceptedAt = new Date().toISOString();
    const termoDocumentId = String((termo as any).documentId ?? (termo as any).id ?? "");
   
    const termoVersion = String(
      (termo as any).version ?? (termo as any).title ?? (termo as any).id ?? (termo as any).createdAt ?? new Date().toISOString(),
    );

    // Atualiza o Master com a data e o ID do termo aceito
    const master = await strapi
      .documents("api::master.master")
      .findFirst({
        filters: { user: { id: userId } },
        fields: ["documentId"],
      });

    if (!master) return ctx.notFound("Master não encontrado.");

    await strapi.documents("api::master.master").update({
      documentId: master.documentId,
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

    // Evita aceitar a MESMA VERSÃO mais de uma vez.
    // Se já existe um registro para este user + termo (ou termDocumentId) com a mesma versão,
    // considera como já aceito e retorna erro.
    const termoId = (termo as any).id;
    let existing = null as any;

    if (termoId) {
      existing = await strapi.documents("api::term-list.term-list").findFirst({
        filters: { user: { id: userId }, termo: { id: termoId }, version: termoVersion },
        fields: ["id"],
      });
    } else {
      existing = await strapi.documents("api::term-list.term-list").findFirst({
        filters: { user: { id: userId }, termDocumentId: termoDocumentId, version: termoVersion },
        fields: ["id"],
      });
    }

    if (existing) {
      return ctx.badRequest("Termo já aceito para esta versão.");
    }

    // Não existe aceite para esta versão: cria um novo registro no histórico
    await strapi.documents("api::term-list.term-list").create({
      data: {
        user: userId,
        termo: termoId || undefined,
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
