// Service do módulo Municipe: implementa regras de negócio para gestão do perfil e dados do Municipe.
// Depende de: Zod (validação de dados); document API do Strapi.

import { ZodError } from 'zod';
import { AcceptTermsSchema } from '../validation/AcceptTermsSchema';
import { getActiveTermo } from '../../termo/utils/getActiveTermo';
import { getUserRoleName } from './helpers/get-user-role-name';
import { getFirstAccessControl } from './helpers/get-first-access-control';

// Exporta o handler principal do módulo Municipe.
export default ({ strapi }: { strapi: any }) => ({
  // Executa rotina de gestão do perfil e dados do Municipe.
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized('Token inválido ou ausente.');

    const roleName = getUserRoleName(ctx);
    if (roleName !== 'Municipe') return ctx.forbidden('Apenas Municipe.');

    let payload: { version: string; contentHash: string };
    try {
      payload = AcceptTermsSchema.parse(ctx.request.body || {});
    } catch (err) {
      // Executa rotina de gestão do perfil e dados do Municipe.
      if (err instanceof ZodError) {
        return ctx.badRequest('Body inválido. Envie { version, contentHash }.');
      }
      throw err;
    }

    const termo = await getActiveTermo(strapi);
    if (!termo) return ctx.badRequest('Nenhum termo ativo disponível para aceite.');

    if (
      payload.version !== (termo as any).version ||
      payload.contentHash !== (termo as any).contentHash
    ) {
      return ctx.badRequest('Termo desatualizado. Atualize e tente novamente.');
    }

    let fac = await getFirstAccessControl(strapi, userId);

    if (!fac) {
      fac = await strapi.documents('api::first-access-control.first-access-control').create({
        data: {
          user: userId,
          mustCompleteProfile: false,
          mustAcceptTerms: true,
          mustChangePassword: false,
          tempPasswordExpiresAt: new Date().toISOString(),
        },
      });
    }

    await strapi.documents('api::first-access-control.first-access-control').update({
      documentId: String((fac as any).documentId || (fac as any).id),
      data: {
        mustAcceptTerms: false,
        termsAcceptedAt: new Date().toISOString(),
        termsVersionAccepted: payload.version,
        termsContentHashAccepted: payload.contentHash,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
        tempPasswordIssuedAt: null,
        tempPasswordUsedAt: null,
      },
    });

    return { accepted: true };
  },
});