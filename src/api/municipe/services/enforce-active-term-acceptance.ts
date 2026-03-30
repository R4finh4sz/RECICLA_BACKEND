// Service do módulo municipe: implementa regras de negócio para gestão do perfil e dados do municipe.
// Depende de: document API do Strapi.

export async function enforceActiveTermAcceptance(strapi: any, fac: any) {
  
  // Chamando o serviço pelo container do Strapi
  const termo = await strapi.service('api::termo.get-active-termo').execute();

  // Se não existe termo ativo, força aceite pendente para Municipe
  if (!termo) {
    (fac as any).mustAcceptTerms = true;
    return { fac, termo: null };
  }

  const acceptedVersion = (fac as any).termsVersionAccepted ?? null;
  const acceptedHash = (fac as any).termsContentHashAccepted ?? null;
  const mustAcceptTerms = Boolean((fac as any).mustAcceptTerms);

  const needsReaccept =
    acceptedVersion !== (termo as any).version ||
    acceptedHash !== (termo as any).contentHash;

  // Se termo mudou e não está marcado como pendente, marca como pendente
  if (needsReaccept && !mustAcceptTerms) {
    const facId = String((fac as any).documentId || (fac as any).id);

    await strapi
      .documents('api::first-access-control.first-access-control')
      .update({
        documentId: facId,
        data: {
          mustAcceptTerms: true,
          termsAcceptedAt: null,
        },
      });

    (fac as any).mustAcceptTerms = true;
    (fac as any).termsAcceptedAt = null;
  }

  return { fac, termo };
}