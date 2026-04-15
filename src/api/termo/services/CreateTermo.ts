
import { errors } from '@strapi/utils';
const { ApplicationError } = errors;

class CreateTermo {
  async execute(ctx: any) {
    try {
      const data = ctx.request.body?.data || ctx.request.body;
      if (!data) throw new ApplicationError('Body inválido.');

      const created = await strapi.documents('api::termo.termo').create({
        data: {
          title: data.title,
          content: data.content,
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