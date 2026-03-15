/**
 * auth-security router
 */

import { factories } from '@strapi/strapi';

// Exporta o handler principal do módulo auth-security.
export default factories.createCoreRouter('api::auth-security.auth-security');
