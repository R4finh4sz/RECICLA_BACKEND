/**
 * auth-security service
 */

import { factories } from '@strapi/strapi';

// Exporta o handler principal do módulo auth-security.
export default factories.createCoreService('api::auth-security.auth-security');
