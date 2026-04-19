import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::municipe.municipe",
  ({ strapi }) => ({
    async create(ctx) {
      const result = await strapi
        .service("api::municipe.register-public")
        .execute(ctx);
      if (ctx.body) return;
      ctx.status = 201;
      ctx.body = {
        data: result,
        message:
          "Cadastro realizado com sucesso! Você já pode acessar sua conta.",
      };
    },
    async onboardingStatus(ctx) {
      const result = await strapi
        .service("api::municipe.onboarding-status")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Status de onboarding carregado." };
    },

    async onboardingAcceptTerms(ctx) {
      const result = await strapi
        .service("api::municipe.onboarding-accept-terms")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = {
        data: result,
        message: "Termos de uso aceitos com sucesso!",
      };
    },

    async onboardingAcceptTermsPublic(ctx) {
      const result = await strapi
        .service("api::municipe.onboarding-accept-terms-public")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = {
        data: result,
        message: "Termos de uso aceitos com sucesso!",
      };
    },

    async me(ctx) {
      const result = await strapi.service("api::municipe.me").execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Dados do municipe carregados." };
    },

    async updateMe(ctx) {
      const result = await strapi
        .service("api::municipe.update-me")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Dados atualizados com sucesso!" };
    },

    async changePassword(ctx) {
      const result = await strapi
        .service("api::municipe.change-password")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Senha alterada com sucesso!" };
    },

    async deleteAccount(ctx) {
      const result = await strapi
        .service("api::municipe.delete-account")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Conta excluida permanentemente." };
    },

    async requestPasswordReset(ctx) {
      const result = await strapi
        .service("api::municipe.request-password-reset")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = {
        data: result,
        message: "Se o usuário existir, um e-mail foi enviado com instruções.",
      };
    },

    async validatePasswordResetCode(ctx) {
      const result = await strapi
        .service("api::municipe.validate-password-reset-code")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Código validado com sucesso." };
    },

    async resetPassword(ctx) {
      const result = await strapi
        .service("api::municipe.reset-password")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Senha redefinida com sucesso!" };
    },

    async confirmEmailCode(ctx) {
      const result = await strapi
        .service("api::municipe.confirm-email-code")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "E-mail confirmado com sucesso!" };
    },

    async resendEmailConfirmationCode(ctx) {
      const result = await strapi
        .service("api::municipe.resend-email-confirmation-code")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = {
        data: result,
        message: "Se a conta existir, um novo código foi enviado.",
      };
    },

    async loginMunicipe(ctx) {
      const result = await strapi
        .service("api::municipe.municipe-login")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Codigo de verificacao enviado para o e-mail." };
    },

    async verifyLoginTwoFactor(ctx) {
      const result = await strapi
        .service("api::municipe.verify-login-2fa")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Login realizado com sucesso!" };
    },

    async resendLoginTwoFactorCode(ctx) {
      const result = await strapi
        .service("api::municipe.resend-login-2fa-code")
        .execute(ctx);
      if (ctx.body) return;
      ctx.body = { data: result, message: "Se a sessao existir, um novo codigo foi enviado." };
    },

  }),
);
