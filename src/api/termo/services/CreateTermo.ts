// Service do módulo termo: implementa regras de negócio para cadastro de registros do módulo.
// Depende de: @strapi/utils (erros/utilitários); document API do Strapi.

const utils = require('@strapi/utils');
const { ApplicationError } = utils.errors;

class CreateTermo {
  // Executa rotina de cadastro de registros do módulo.
  async execute(ctx: any) {
    try {
      const data = ctx.request.body?.data;
      if (!data) throw new ApplicationError('Body inválido. Envie { data: {...} }.');

      const created = await strapi.documents('api::termo.termo').create({
        data: {
          version: data.version,
          title: data.title,
          content: data.content,
          active: Boolean(data.active),
          // O hook beforeCreate no lifecycles.ts vai sobrescrever isso com o hash real.
          contentHash: '', 
        },
      });

      ctx.body = { data: created };
      ctx.status = 201;
    } catch (err: any) {
      strapi.log.error(err);

      throw new ApplicationError(
        err?.message || 'Não foi possível criar o termo, tente novamente.'
      );
    }
  }
}

export { CreateTermo };