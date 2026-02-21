// Service do módulo termo: implementa regras de negócio para gestão de termos (aceite/consulta/atualização).
// Depende de: document API do Strapi.

class GetActiveTermo {
  // Executa rotina de gestão de termos (aceite/consulta/atualização).
  async execute(ctx: any) {
    const termo = await strapi.documents('api::termo.termo').findFirst({
      filters: { active: { $eq: true } },
      sort: { updatedAt: 'desc' },
    });

    // Executa rotina de gestão de termos (aceite/consulta/atualização).
    if (!termo) {
      ctx.notFound('Nenhum termo ativo encontrado.');
      return;
    }

    ctx.body = { data: termo };
  }
}

export { GetActiveTermo };