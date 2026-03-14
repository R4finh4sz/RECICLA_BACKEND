// Rotas do módulo municipes: define endpoints e vincula handlers.

export default {
  routes: [
    // Cadastro público de municipe (deslogado)
    {
      method: 'POST',
      path: '/municipes',
      handler: 'api::municipe.municipe.create',
      config: { auth: false },
    },

    // Onboarding: status
    {
      method: 'GET',
      path: '/auth/onboarding/status',
      handler: 'api::municipe.municipe.onboardingStatus',
      config: {
        auth: {},
        policies: ['global::municipe-onboarding-guard'],
      },
    },

    // Onboarding: aceitar termos
    {
      method: 'POST',
      path: '/auth/onboarding/accept-terms',
      handler: 'api::municipe.municipe.onboardingAcceptTerms',
      config: {
        auth: {},
        policies: ['global::municipe-onboarding-guard'],
      },
    },

    // Municipe: ver / atualizar perfil
    {
      method: 'GET',
      path: '/municipes/me',
      handler: 'api::municipe.municipe.me',
      config: {
        auth: {},
        policies: ['global::municipe-onboarding-guard'],
      },
    },
    {
      method: 'PUT',
      path: '/municipes/me',
      handler: 'api::municipe.municipe.updateMe',
      config: {
        auth: {},
        policies: ['global::municipe-onboarding-guard'],
      },
    },

    // =========================
    // ROTAS AUTH MUNICIPE
    // =========================

    // Logado: trocar senha (senha atual + nova)
    {
      method: 'POST',
      path: '/auth/change-password',
      handler: 'api::municipe.municipe.changePassword',
      config: {
        auth: {}, // exige JWT
      },
    },

    // Deslogado: solicitar código por e-mail
    {
      method: 'POST',
      path: '/auth/request-password-reset',
      handler: 'api::municipe.municipe.requestPasswordReset',
      config: { auth: false },
    },

    // Deslogado: resetar senha com código
    {
      method: 'POST',
      path: '/auth/reset-password',
      handler: 'api::municipe.municipe.resetPassword',
      config: { auth: false },
    },

    // Deslogado: confirmar e-mail com código
    {
      method: 'POST',
      path: '/auth/confirm-email-code',
      handler: 'api::municipe.municipe.confirmEmailCode',
      config: { auth: false },
    },

    // Deslogado: reenviar código de confirmação
    {
      method: 'POST',
      path: '/auth/resend-email-confirmation-code',
      handler: 'api::municipe.municipe.resendEmailConfirmationCode',
      config: { auth: false },
    },

    {
      method: 'POST',
      path: '/auth/municipe/login',
      handler: 'api::municipe.municipe.loginMunicipe',
      config: { auth: false },
    },
  ],
};