// Rotas do módulo termo: define endpoints e vincula handlers.

export default {
  routes: [
    {
      method: 'GET',
      path: '/termos/active',
      handler: 'api::termo.termo.getActive',
      config: { auth: false },
    },
  ],
};