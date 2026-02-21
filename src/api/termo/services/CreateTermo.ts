// Service do módulo termo: implementa regras de negócio para cadastro de registros do módulo.
// Depende de: @strapi/utils (erros/utilitários); transações do Strapi (integridade); document API do Strapi.

const utils = require('@strapi/utils');
const { ApplicationError } = utils.errors;

class CreateTermo {
  // Executa rotina de cadastro de registros do módulo.
  async execute(ctx: any) {
    return strapi.db.transaction(async () => {
      try {
        const data = ctx.request.body?.data;
        if (!data) throw new ApplicationError('Body inválido. Envie { data: {...} }.');

        const created = await strapi.documents('api::termo.termo').create({
          data: {
            version: data.version,
            title: data.title,
            content: data.content,
            active: Boolean(data.active),
          },
        });

        // Se marcar active=true, desativa os outros
        if (created?.active) {
          const others = await strapi.documents('api::termo.termo').findMany({
            filters: {
              active: { $eq: true },
              documentId: { $ne: String(created.documentId || created.id) },
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

        ctx.body = { data: created };
        ctx.status = 201;
      } catch (err: any) {
        strapi.log.error(err);

        // Unique constraint de version costuma cair aqui
        throw new ApplicationError(
          err?.message || 'Não foi possível criar o termo, tente novamente.'
        );
      }
    });
  }
}

export { CreateTermo };