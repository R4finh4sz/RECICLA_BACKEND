// Service do módulo Municipe: implementa regras de negócio para gestão do perfil e dados do Municipe.

import { getUserRoleName } from './helpers/get-user-role-name';
import { enforceActiveTermAcceptance } from './helpers/enforce-active-term-acceptance';
import { getFirstAccessControl } from './helpers/get-first-access-control';

function isProfileComplete(municipe: any) {
  return (
    Boolean(municipe?.endereco) &&
    Boolean(municipe?.cep) &&
    Boolean(municipe?.cidade) &&
    Boolean(municipe?.estado) &&
    Boolean(municipe?.telefone)
  );
}

// Exporta o handler principal do módulo Municipe.
export default ({ strapi }: { strapi: any }) => ({
  // Executa rotina de gestão do perfil e dados do Municipe.
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized('Token inválido ou ausente.');

    const roleName = getUserRoleName(ctx);
    if (roleName !== 'Municipe') return ctx.forbidden('Apenas Municipe.');

    const municipe = await strapi.documents('api::municipe.municipe').findFirst({
      filters: { user: { id: userId as any } },
      fields: ['id', 'endereco', 'cep', 'cidade', 'estado', 'telefone'],
    });

    if (!municipe) return ctx.notFound('Municipe não encontrado.');

    let fac = await getFirstAccessControl(strapi, userId);

    if (!fac) {
      fac = await strapi.documents('api::first-access-control.first-access-control').create({
        data: {
          user: userId,
          mustCompleteProfile: !isProfileComplete(municipe),
          mustAcceptTerms: true,
          mustChangePassword: false,
          tempPasswordExpiresAt: new Date().toISOString(),
        },
      });
    }

    if (Boolean((fac as any).mustChangePassword)) {
      fac = await strapi.documents('api::first-access-control.first-access-control').update({
        documentId: String((fac as any).documentId || (fac as any).id),
        data: {
          mustChangePassword: false,
          tempPasswordExpiresAt: null,
          tempPasswordIssuedAt: null,
          tempPasswordUsedAt: null,
        },
      });
    }

    const { fac: normalizedFac, termo } = await enforceActiveTermAcceptance(strapi, fac);

    const mustCompleteProfile = Boolean((normalizedFac as any).mustCompleteProfile);
    const mustAcceptTerms = Boolean((normalizedFac as any).mustAcceptTerms);
    const mustChangePassword = Boolean((normalizedFac as any).mustChangePassword);

    return {
      mustCompleteProfile,
      mustAcceptTerms,
      mustChangePassword,
      onboardingPending: mustCompleteProfile || mustAcceptTerms || mustChangePassword,
      termoAtivo: termo
        ? {
            version: (termo as any).version,
            contentHash: (termo as any).contentHash,
          }
        : null,
    };
  },
});