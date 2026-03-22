import { getUserRoleName } from './helpers/get-user-role-name';
import { pickAllowedMunicipeUpdate } from './helpers/pick-allowed-municipe-update';

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized('Token inválido ou ausente.');

    const roleName = getUserRoleName(ctx);
    if (roleName !== 'Municipe') return ctx.forbidden('Apenas Municipe.');

    if (ctx?.request?.body?.nome !== undefined) return ctx.badRequest('Não é permitido alterar o nome.');
    if (ctx?.request?.body?.cpf !== undefined) return ctx.badRequest('Não é permitido alterar o CPF.');
    if (ctx?.request?.body?.email !== undefined) return ctx.badRequest('Não é permitido alterar o e-mail.');
    if (ctx?.request?.body?.user !== undefined) return ctx.badRequest('Não é permitido alterar o vínculo de usuário.');
    if (ctx?.request?.body?.dataNascimento !== undefined) return ctx.badRequest('Não é permitido alterar a data de nascimento.');

    const municipe = await strapi.documents('api::municipe.municipe').findFirst({
      filters: { user: { id: userId as any } },
      fields: ['id', 'documentId', 'statusCadastro'],
    });

    if (!municipe) return ctx.notFound('Municipe não encontrado.');

    const statusCadastro = String((municipe as any).statusCadastro || '');
    if (statusCadastro === 'AGUARDANDO_VALIDACAO') {
      return ctx.forbidden('Cadastro aguardando validação. Não é permitido alterar dados neste momento.');
    }
    if (statusCadastro === 'ARQUIVADO') {
      return ctx.forbidden('Cadastro arquivado. Entre em contato com o suporte.');
    }

    const updateData = pickAllowedMunicipeUpdate(ctx.request.body || {});
    if (Object.keys(updateData).length === 0) {
      return ctx.badRequest('Nenhum campo permitido para atualização foi enviado.');
    }

    const updated = await strapi.documents('api::municipe.municipe').update({
      documentId: String((municipe as any).documentId || (municipe as any).id),
      data: updateData,
    });

    const isComplete =
      Boolean((updated as any)?.endereco) &&
      Boolean((updated as any)?.cep) &&
      Boolean((updated as any)?.cidade) &&
      Boolean((updated as any)?.telefone);

    const fac = await strapi.documents('api::first-access-control.first-access-control').findFirst({
      filters: { user: { id: userId as any } },
      fields: ['id', 'documentId'],
    });

    if (fac) {
      await strapi.documents('api::first-access-control.first-access-control').update({
        documentId: String((fac as any).documentId || (fac as any).id),
        data: {
          mustCompleteProfile: !isComplete,
          profileCompletedAt: isComplete ? new Date().toISOString() : null,
          mustChangePassword: false,
          tempPasswordExpiresAt: null,
          tempPasswordIssuedAt: null,
          tempPasswordUsedAt: null,
        },
      });
    } else {
      await strapi.documents('api::first-access-control.first-access-control').create({
        data: {
          user: userId,
          mustCompleteProfile: !isComplete,
          profileCompletedAt: isComplete ? new Date().toISOString() : null,
          mustAcceptTerms: true,
          mustChangePassword: false,
          tempPasswordExpiresAt: new Date().toISOString(),
        },
      });
    }

    return updated;
  },
});