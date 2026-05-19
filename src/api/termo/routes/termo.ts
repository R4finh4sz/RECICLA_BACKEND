// Rotas do módulo termo: define endpoints e vincula handlers.

import { factories } from '@strapi/strapi';

// Exporta o handler principal do módulo termo.
export default factories.createCoreRouter('api::termo.termo', {
  config: {
    find: { auth: false },
    findOne: { auth: false },
    create: { auth: { scope: [] }, policies: ['global::master-only'] },
    update: { auth: { scope: [] }, policies: ['global::master-only'] },
    delete: { auth: { scope: [] }, policies: ['global::master-only'] },
  },
});