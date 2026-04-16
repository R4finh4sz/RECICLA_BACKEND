// Rotas customizadas do módulo Municipe.
// Aqui eu centralizo os endpoints que o app consome (cadastro, login, etc.).
// Eu preferi custom route porque fica mais claro o que é “público” e o que é “protegido”.
// Também deixei aqui a rota de consulta de CEP (RN 3.4.5) para eu conseguir demonstrar a integração no Postman.

export default {
  routes: [
    // Consulta de CEP (deslogado) - RN 3.4.5.
    // Eu uso isso para validar se o CEP existe e para trazer Endereço/Cidade/Estado via ViaCEP.
    {
      method: "GET",
      path: "/cep/:cep",
      handler: "api::municipe.municipe.lookupCep",
      config: { auth: false },
    },

    // Cadastro público (deslogado).
    {
      method: "POST",
      path: "/register/municipes",
      handler: "api::municipe.municipe.create",
      config: { auth: false },
    },

    // Status do onboarding (termos/perfil/etc.).
    {
      method: "GET",
      path: "/auth/onboarding/status",
      handler: "api::municipe.municipe.onboardingStatus",
      config: {
        auth: {},
        policies: ["global::municipe-onboarding-guard"],
      },
    },

    // Aceite dos termos (obrigatório para liberar acesso).
    {
      method: "PATCH",
      path: "/auth/onboarding/accept-terms",
      handler: "api::municipe.municipe.onboardingAcceptTerms",
      config: {
        auth: {},
        policies: ["global::municipe-onboarding-guard"],
      },
    },

    // Aceite dos termos sem bearer token (autentica por e-mail e senha no body).
    {
      method: "PATCH",
      path: "/auth/onboarding/accept-terms/public",
      handler: "api::municipe.municipe.onboardingAcceptTermsPublic",
      config: { auth: false },
    },

    // Perfil do municipe logado.
    {
      method: "GET",
      path: "/municipes/me",
      handler: "api::municipe.municipe.me",
      config: {
        auth: {},
        policies: ["global::municipe-onboarding-guard"],
      },
    },

    // Atualização de dados permitidos
    {
      method: "PUT",
      path: "/municipes/me",
      handler: "api::municipe.municipe.updateMe",
      config: {
        auth: {},
        policies: ["global::municipe-onboarding-guard"],
      },
    },

    // Troca de senha do usuário autenticado.
    {
      method: "POST",
      path: "/auth/change-password",
      handler: "api::municipe.municipe.changePassword",
      config: {
        auth: {},
      },
    },

    // Solicitar código de reset de senha (deslogado).
    {
      method: "POST",
      path: "/auth/request-password-reset",
      handler: "api::municipe.municipe.requestPasswordReset",
      config: { auth: false },
    },

    // Validar código recebido por e-mail (deslogado).
    {
      method: "POST",
      path: "/auth/password-reset/validate-code",
      handler: "api::municipe.municipe.validatePasswordResetCode",
      config: { auth: false },
    },

    // Efetivar reset de senha (deslogado) usando token obtido na validação.
    {
      method: "PATCH",
      path: "/auth/reset-password",
      handler: "api::municipe.municipe.resetPassword",
      config: { auth: false },
    },

    // Confirmação de e-mail por código (deslogado).
    {
      method: "POST",
      path: "/auth/confirm-email-code",
      handler: "api::municipe.municipe.confirmEmailCode",
      config: { auth: false },
    },

    // Reenvio do código de confirmação (deslogado).
    {
      method: "POST",
      path: "/auth/resend-email-confirmation-code",
      handler: "api::municipe.municipe.resendEmailConfirmationCode",
      config: { auth: false },
    },

    // Login do municipe (deslogado).
    {
      method: "POST",
      path: "/auth/local",
      handler: "api::municipe.municipe.loginMunicipe",
      config: { auth: false },
    },

    // Verificacao do codigo 2FA para concluir login.
    {
      method: "POST",
      path: "/auth/local/verify-code",
      handler: "api::municipe.municipe.verifyLoginTwoFactor",
      config: { auth: false },
    },

    // Reenvio do codigo 2FA durante login.
    {
      method: "POST",
      path: "/auth/local/resend-code",
      handler: "api::municipe.municipe.resendLoginTwoFactorCode",
      config: { auth: false },
    },
  ],
};
