// Controller do módulo municipe: recebe requisições HTTP e delega regras de negócio.

import { factories } from '@strapi/strapi';

// Exporta o handler principal do módulo municipe.
export default factories.createCoreController('api::municipe.municipe', ({ strapi }) => ({

  // Cadastro público de municipe (deslogado) com criação de usuário
  async create(ctx) {
    const result = await strapi.service('api::municipe.register-public').execute(ctx);
    if (ctx.body) return;
    ctx.status = 201;
    ctx.body = { data: result, message: 'Cadastro realizado com sucesso. Confirme seu e-mail para acessar.' };
  },

  // Executa rotina de gestão do perfil e dados do municipe.
  async onboardingStatus(ctx) {
    const result = await strapi.service('api::municipe.onboarding-status').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result, message: 'Status de onboarding carregado.' };
  },

  // Executa rotina de gestão do perfil e dados do municipe.
  async onboardingAcceptTerms(ctx) {
    const result = await strapi.service('api::municipe.onboarding-accept-terms').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result, message: 'Termos de uso aceitos com sucesso!' };
  },

  async me(ctx) {
    const result = await strapi.service('api::municipe.me').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result, message: 'Dados do municipe carregados.' };
  },

  // Executa rotina de gestão do perfil e dados do municipe.
  async updateMe(ctx) {
    const result = await strapi.service('api::municipe.update-me').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result, message: 'Dados atualizados com sucesso!' };
  },

  // Altera a senha do usuário logado após validações.
  async changePassword(ctx) {
    const result = await strapi.service('api::municipe.change-password').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result, message: 'Senha alterada com sucesso!' };
  },

  // Executa rotina de gestão do perfil e dados do municipe.
  async requestPasswordReset(ctx) {
    const result = await strapi.service('api::municipe.request-password-reset').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result, message: 'Se o usuário existir, um e-mail foi enviado com instruções.' };
  },

  // Executa rotina de gestão do perfil e dados do municipe.
  async resetPassword(ctx) {
    const result = await strapi.service('api::municipe.reset-password').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result, message: 'Senha redefinida com sucesso!' };
  },

  // Confirma e-mail por código digitado no app.
  async confirmEmailCode(ctx) {
    const result = await strapi.service('api::municipe.confirm-email-code').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result, message: 'E-mail confirmado com sucesso!' };
  },

  // Reenvia código de confirmação por e-mail com controle de tentativas.
  async resendEmailConfirmationCode(ctx) {
    const result = await strapi.service('api::municipe.resend-email-confirmation-code').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result, message: 'Se a conta existir, um novo código foi enviado.' };
  },

  // Executa rotina de gestão do perfil e dados do municipe.
  async loginMunicipe(ctx) {
    const result = await strapi.service('api::municipe.municipe-login').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result, message: 'Login realizado com sucesso!' };
  },

  async adminPending(ctx) {
    const result = await strapi.service('api::municipe.admin-pending').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result };
  },

  async adminApprove(ctx) {
    const result = await strapi.service('api::municipe.admin-approve').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result };
  },

  async adminReject(ctx) {
    const result = await strapi.service('api::municipe.admin-reject').execute(ctx);
    if (ctx.body) return;
    ctx.body = { data: result };
  },
}));