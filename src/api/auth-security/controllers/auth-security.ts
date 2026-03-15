/**
 * auth-security controller
 */

import { factories } from '@strapi/strapi';

// Exporta o handler principal do módulo auth-security.
export default factories.createCoreController('api::auth-security.auth-security');
