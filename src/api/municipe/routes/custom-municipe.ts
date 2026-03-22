export default {
  routes: [
    {
      method: 'POST',
      path: '/municipes',
      handler: 'api::municipe.municipe.create',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/auth/onboarding/status',
      handler: 'api::municipe.municipe.onboardingStatus',
      config: {
        auth: {},
        policies: ['global::municipe-onboarding-guard'],
      },
    },
    {
      method: 'POST',
      path: '/auth/onboarding/accept-terms',
      handler: 'api::municipe.municipe.onboardingAcceptTerms',
      config: {
        auth: {},
        policies: ['global::municipe-onboarding-guard'],
      },
    },
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
    {
      method: 'POST',
      path: '/auth/change-password',
      handler: 'api::municipe.municipe.changePassword',
      config: {
        auth: {},
      },
    },
    {
      method: 'POST',
      path: '/auth/request-password-reset',
      handler: 'api::municipe.municipe.requestPasswordReset',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/auth/reset-password',
      handler: 'api::municipe.municipe.resetPassword',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/auth/confirm-email-code',
      handler: 'api::municipe.municipe.confirmEmailCode',
      config: { auth: false },
    },
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

    {
      method: 'GET',
      path: '/admin/municipes/pending',
      handler: 'api::municipe.municipe.adminPending',
      config: {
        auth: {},
        policies: ['global::admin-guard'],
      },
    },
    {
      method: 'POST',
      path: '/admin/municipes/:id/approve',
      handler: 'api::municipe.municipe.adminApprove',
      config: {
        auth: {},
        policies: ['global::admin-guard'],
      },
    },
    {
      method: 'POST',
      path: '/admin/municipes/:id/reject',
      handler: 'api::municipe.municipe.adminReject',
      config: {
        auth: {},
        policies: ['global::admin-guard'],
      },
    },
  ],
};