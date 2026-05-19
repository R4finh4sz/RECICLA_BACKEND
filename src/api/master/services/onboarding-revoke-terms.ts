import { getUserRoleName } from "./helpers/get-user-role-name";
import { TokenRevocationService } from "./token-revocation.service";

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized("Token invalido ou ausente.");

    const roleName = getUserRoleName(ctx);
    if (roleName !== "Master") return ctx.forbidden("Apenas Master.");

    const master = await strapi
      .documents("api::master.master")
      .findFirst({
        filters: { user: { id: userId } },
        fields: ["documentId", "id"],
      });

    if (!master) return ctx.notFound("Master nao encontrado.");

    await strapi.documents("api::master.master").update({
      documentId: String((master as any).documentId || (master as any).id),
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

    // Revogar token atual (se fornecido) para forçar logout
    try {
      const authHeader = String(ctx?.request?.header?.authorization || "");
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        if (token) {
          const revocationService = new TokenRevocationService(strapi);
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 2);
          await revocationService.revoke(token, expiresAt);
        }
      }
    } catch (err) {
      strapi.log.error('[terms-consent] falha ao revogar token durante revogacao de termos', err);
    }

    strapi.log.warn(`[terms-consent] revogacao registrada userId=${userId}`);

    return {
      success: true,
      revokedAt: new Date().toISOString(),
      mustAcceptTerms: true,
    };
  },
});
