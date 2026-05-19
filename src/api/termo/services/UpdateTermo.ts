// Service do módulo termo: implementa regras de negócio para atualização de termos.
import { errors } from '@strapi/utils';
const { ApplicationError } = errors;

class UpdateTermo {
  async execute(ctx: any) {
    try {
      const roleName = ctx?.state?.user?.role?.name || ctx?.state?.user?.role;
      if (roleName !== 'Master') {
        throw new ApplicationError('Apenas Master pode atualizar termos.');
      }

      const documentId = ctx.params?.id;
      if (!documentId) throw new ApplicationError('documentId ausente na rota.');

      const data = ctx.request.body?.data || ctx.request.body;
      if (!data) throw new ApplicationError('Body inválido.');

      const updated = await strapi.documents('api::termo.termo').update({
        documentId: String(documentId),
        data: {
          title: data.title,
          content: data.content,
        },
      });

      ctx.body = { data: updated };
    } catch (err: any) {
      strapi.log.error(err);
      throw new ApplicationError(
        err?.message || 'Não foi possível atualizar o termo, tente novamente.'
      );
    }
  }
}

export { UpdateTermo };