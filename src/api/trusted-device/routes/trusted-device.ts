// Rotas do módulo trusted-device: define endpoints e vincula handlers.

export default {
  routes: [
    {
      method: 'DELETE',
      path: '/trusted-devices/:id/disconnect',
      handler: 'api::trusted-device.trusted-device.disconnect',
      config: {
        auth: {}, // exige JWT
        // policies: [], // políticas extras
      },
    },
  ],
};