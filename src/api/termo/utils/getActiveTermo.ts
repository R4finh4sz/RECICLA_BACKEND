// Módulo termo: arquivo de suporte para gestão de termos (aceite/consulta/atualização).
// Depende de: document API do Strapi.

export async function getActiveTermo(strapi: any) {
  return strapi.documents('api::termo.termo').findFirst({
    filters: { active: { $eq: true } },
    sort: { updatedAt: 'desc' },
  });
}