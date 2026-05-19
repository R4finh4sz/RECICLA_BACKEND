import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::master.master",
  ({ strapi }) => ({
    async onboardingStatus(ctx) {
      const result = await strapi
        .service("api::master.onboarding-status")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Status de onboarding carregado." };
    },

    async onboardingAcceptTerms(ctx) {
      const result = await strapi
        .service("api::master.onboarding-accept-terms")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = {
        data: result,
        message: "Termos de uso aceitos com sucesso!",
      };
    },

    async onboardingRevokeTerms(ctx) {
      const result = await strapi
        .service("api::master.onboarding-revoke-terms")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = {
        data: result,
        message: "Consentimento revogado com sucesso.",
      };
    },

    async me(ctx) {
      const result = await strapi.service("api::master.me").execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Dados do master carregados." };
    },

    async updateMe(ctx) {
      const result = await strapi
        .service("api::master.update-me")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Dados atualizados com sucesso!" };
    },

    async changePassword(ctx) {
      const result = await strapi
        .service("api::master.change-password")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Senha alterada com sucesso!" };
    },

    async deleteAccount(ctx) {
      const result = await strapi
        .service("api::master.delete-account")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Conta excluida permanentemente." };
    },

    async requestPasswordReset(ctx) {
      const result = await strapi
        .service("api::master.request-password-reset")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = {
        data: result,
        message: "Se o usuário existir, um e-mail foi enviado com instruções.",
      };
    },

    async validatePasswordResetCode(ctx) {
      const result = await strapi
        .service("api::master.validate-password-reset-code")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Código validado com sucesso." };
    },

    async resetPassword(ctx) {
      const result = await strapi
        .service("api::master.reset-password")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Senha redefinida com sucesso!" };
    },

    async confirmEmailCode(ctx) {
      const result = await strapi
        .service("api::master.confirm-email-code")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "E-mail confirmado com sucesso!" };
    },

    async resendEmailConfirmationCode(ctx) {
      const result = await strapi
        .service("api::master.resend-email-confirmation-code")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = {
        data: result,
        message: "Se a conta existir, um novo código foi enviado.",
      };
    },

    async loginMaster(ctx) {
      const result = await strapi
        .service("api::master.master-login")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Codigo de verificacao enviado para o e-mail." };
    },

    async verifyLoginTwoFactor(ctx) {
      const result = await strapi
        .service("api::master.verify-login-2fa")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Login realizado com sucesso!" };
    },

    async resendLoginTwoFactorCode(ctx) {
      const result = await strapi
        .service("api::master.resend-login-2fa-code")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Se a sessao existir, um novo codigo foi enviado." };
    },

    async logout(ctx) {
      const { request } = ctx;
      const authHeader = request.header && request.header.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.badRequest('No token provided');
      }

      const token = authHeader.split(' ')[1];

      const { TokenRevocationService } = await import("../services/token-revocation.service.js");
      const revocationService = new TokenRevocationService(strapi);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 2);

      await revocationService.revoke(token, expiresAt);

      ctx.send({ message: 'Successfully logged out and token invalidated' });
    },

  }),
);
