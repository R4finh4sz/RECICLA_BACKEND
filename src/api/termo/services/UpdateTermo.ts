// Service do módulo termo: implementa regras de negócio para gestão de termos (aceite/consulta/atualização).
// Depende de: @strapi/utils (erros/utilitários); transações do Strapi (integridade); document API do Strapi.

const utils = require('@strapi/utils');
const { ApplicationError } = utils.errors;

class UpdateTermo {
  // Executa rotina de gestão de termos (aceite/consulta/atualização).
  async execute(ctx: any) {
    return strapi.db.transaction(async () => {
      try {
        const documentId = ctx.params?.id;
        if (!documentId) throw new ApplicationError('documentId ausente na rota.');

        const data = ctx.request.body?.data;
        if (!data) throw new ApplicationError('Body inválido. Envie { data: {...} }.');

        const updated = await strapi.documents('api::termo.termo').update({
          documentId: String(documentId),
          data: {
            version: data.version,
            title: data.title,
            content: data.content,
            active: data.active,
          },
        });

        // Se marcar active=true, desativa os outros
        if (updated?.active) {
          const others = await strapi.documents('api::termo.termo').findMany({
            filters: {
              active: { $eq: true },
              documentId: { $ne: String(updated.documentId || updated.id) },
            },
            fields: ['documentId'],
          });

          await Promise.all(
            (others || []).map((t: any) =>
              strapi.documents('api::termo.termo').update({
                documentId: String(t.documentId),
                data: { active: false },
              })
            )
          );
        }

        ctx.body = { data: updated };
      } catch (err: any) {
        strapi.log.error(err);
        throw new ApplicationError(
          err?.message || 'Não foi possível atualizar o termo, tente novamente.'
        );
      }
    });
  }
}

export { UpdateTermo };