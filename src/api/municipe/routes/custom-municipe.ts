export default {
  routes: [
    {
      method: "POST",
      path: "/register/municipes",
      handler: "api::municipe.municipe.create",
      config: { auth: false },
    },

    {
      method: "GET",
      path: "/auth/onboarding/status",
      handler: "api::municipe.municipe.onboardingStatus",
      config: {
        auth: {},
        policies: ["global::municipe-onboarding-guard"],
      },
    },

    {
      method: "PATCH",
      path: "/auth/onboarding/accept-terms",
      handler: "api::municipe.municipe.onboardingAcceptTerms",
      config: {
        auth: {},
        policies: ["global::municipe-onboarding-guard"],
      },
    },

    {
      method: "PATCH",
      path: "/auth/onboarding/accept-terms/public",
      handler: "api::municipe.municipe.onboardingAcceptTermsPublic",
      config: { auth: false },
    },
    {
      method: "PUT",
      path: "/edit-profile/:id",
      handler: "api::municipe.municipe.updateMe",
      config: {
        auth: {},
        policies: ["global::municipe-onboarding-guard"],
      },
    },
    {
      method: "POST",
      path: "/auth/change-password",
      handler: "api::municipe.municipe.changePassword",
      config: {
        auth: {},
      },
    },

    {
      method: "POST",
      path: "/auth/request-password-reset",
      handler: "api::municipe.municipe.requestPasswordReset",
      config: { auth: false },
    },

    {
      method: "POST",
      path: "/auth/password-reset/validate-code",
      handler: "api::municipe.municipe.validatePasswordResetCode",
      config: { auth: false },
    },

    {
      method: "PATCH",
      path: "/auth/reset-password",
      handler: "api::municipe.municipe.resetPassword",
      config: { auth: false },
    },

    {
      method: "POST",
      path: "/auth/local",
      handler: "api::municipe.municipe.loginMunicipe",
      config: { auth: false },
    },

    {
      method: "POST",
      path: "/auth/local/verify-code",
      handler: "api::municipe.municipe.verifyLoginTwoFactor",
      config: { auth: false },
    },

    {
      method: "POST",
      path: "/auth/local/resend-code",
      handler: "api::municipe.municipe.resendLoginTwoFactorCode",
      config: { auth: false },
    },
  ],
};
