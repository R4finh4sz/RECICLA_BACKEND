// Service do módulo termo: implementa regras de negócio para gestão de termos (aceite/consulta/atualização).
// Depende de: document API do Strapi.

class ListTermo {
  // Executa rotina de gestão de termos (aceite/consulta/atualização).
  async execute(ctx: any) {
    return strapi.documents('api::termo.termo').findMany({
      sort: { updatedAt: 'desc' },
    });
  }
}

export { ListTermo };