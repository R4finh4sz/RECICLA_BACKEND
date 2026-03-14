// Service do módulo Municipe: implementa regras de negócio para fluxo de primeiro acesso e validações iniciais.
// Depende de: document API do Strapi.

export async function getFirstAccessControl(strapi: any, userId: any) {
  return strapi
    .documents('api::first-access-control.first-access-control')
    .findFirst({ filters: { user: { id: userId as any } } });
}