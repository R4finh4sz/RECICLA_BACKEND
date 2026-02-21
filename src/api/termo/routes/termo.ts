// Rotas do módulo termo: define endpoints e vincula handlers.

import { factories } from '@strapi/strapi';

// Exporta o handler principal do módulo termo.
export default factories.createCoreRouter('api::termo.termo', {
  config: {
    find: { auth: false },
    findOne: { auth: false },
    create: { auth: { scope: [] } },
    update: { auth: { scope: [] } },
    delete: { auth: { scope: [] } },
  },
});