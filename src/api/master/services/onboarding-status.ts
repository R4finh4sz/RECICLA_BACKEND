// Service do módulo Master: implementa regras de negócio para gestão do perfil e dados do Master.

import { getUserRoleName } from "./helpers/get-user-role-name";
import { enforceActiveTermAcceptance } from "./helpers/enforce-active-term-acceptance";
import { getFirstAccessControl } from "./helpers/get-first-access-control";

function isProfileComplete(master: any) {
  return (
    Boolean(master?.endereco) &&
    Boolean(master?.cep) &&
    Boolean(master?.cidade) &&
    Boolean(master?.estado) &&
    Boolean(master?.telefone)
  );
}

// Exporta o handler principal do módulo Master.
export default ({ strapi }: { strapi: any }) => ({
  // Executa rotina de gestão do perfil e dados do Master.
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized("Token inválido ou ausente.");

    const roleName = getUserRoleName(ctx);
    if (roleName !== "Master") return ctx.forbidden("Apenas Master.");

    const master = await strapi
      .documents("api::master.master")
      .findFirst({
        filters: { user: { id: userId as any } },
        fields: ["id", "endereco", "cep", "cidade", "estado", "telefone"],
      });

    if (!master) return ctx.notFound("Master não encontrado.");

    let fac = await getFirstAccessControl(strapi, userId);

    if (!fac) {
      fac = await strapi
        .documents("api::first-access-control.first-access-control")
        .create({
          data: {
            user: userId,
            mustCompleteProfile: !isProfileComplete(master),
            mustAcceptTerms: true,
            mustChangePassword: false,
            tempPasswordExpiresAt: new Date().toISOString(),
          },
        });
    }

    if (Boolean((fac as any).mustChangePassword)) {
      fac = await strapi
        .documents("api::first-access-control.first-access-control")
        .update({
          documentId: String((fac as any).documentId || (fac as any).id),
          data: {
            mustChangePassword: false,
            tempPasswordExpiresAt: null,
            tempPasswordIssuedAt: null,
            tempPasswordUsedAt: null,
          },
        });
    }

    const { fac: normalizedFac, termo } = await enforceActiveTermAcceptance(
      strapi,
      fac,
    );

    const mustCompleteProfile = Boolean(
      (normalizedFac as any).mustCompleteProfile,
    );
    const mustAcceptTerms = Boolean((normalizedFac as any).mustAcceptTerms);
    const mustChangePassword = Boolean(
      (normalizedFac as any).mustChangePassword,
    );

    return {
      mustCompleteProfile,
      mustAcceptTerms,
      mustChangePassword,
      onboardingPending:
        mustCompleteProfile || mustAcceptTerms || mustChangePassword,
      termoAtivo: termo
        ? {
            version: (termo as any).version,
            documentId: String((termo as any).documentId || (termo as any).id),
          }
        : null,
    };
  },
});
