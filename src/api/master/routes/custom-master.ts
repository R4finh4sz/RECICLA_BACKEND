export default {
  routes: [
    {
      method: "GET",
      path: "/master/onboarding/status",
      handler: "api::master.master.onboardingStatus",
      config: {
        policies: ["global::master-onboarding-guard"],
      },
    },

    {
      method: "PATCH",
      path: "/master/onboarding/accept-terms",
      handler: "api::master.master.onboardingAcceptTerms",
      config: {
        policies: ["global::master-onboarding-guard"],
      },
    },

    {
      method: "PATCH",
      path: "/master/onboarding/revoke-terms",
      handler: "api::master.master.onboardingRevokeTerms",
      config: {
        policies: ["global::master-onboarding-guard"],
      },
    },
    {
      method: "PUT",
      path: "/master/edit-profile/:id",
      handler: "api::master.master.updateMe",
      config: {
        policies: ["global::master-onboarding-guard"],
      },
    },
    {
      method: "POST",
      path: "/master/auth/change-password",
      handler: "api::master.master.changePassword",
      config: {},
    },

    {
      method: "POST",
      path: "/master/auth/delete-account",
      handler: "api::master.master.deleteAccount",
      config: {},
    },

    {
      method: "POST",
      path: "/master/auth/request-password-reset",
      handler: "api::master.master.requestPasswordReset",
      config: { auth: false },
    },

    {
      method: "POST",
      path: "/master/auth/password-reset/validate-code",
      handler: "api::master.master.validatePasswordResetCode",
      config: { auth: false },
    },

    {
      method: "PATCH",
      path: "/master/auth/reset-password",
      handler: "api::master.master.resetPassword",
      config: { auth: false },
    },

    {
      method: "POST",
      path: "/master/auth/local",
      handler: "api::master.master.loginMaster",
      config: { auth: false },
    },

    {
      method: "POST",
      path: "/master/auth/local/verify-code",
      handler: "api::master.master.verifyLoginTwoFactor",
      config: { auth: false },
    },

    {
      method: "POST",
      path: "/master/auth/local/resend-code",
      handler: "api::master.master.resendLoginTwoFactorCode",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/master/auth/logout",
      handler: "api::master.master.logout",
      config: {},
    },
  ],
};
