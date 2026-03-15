/**
 * password-history service
 */

import { factories } from '@strapi/strapi';

// Exporta o handler principal do módulo password-history.
export default factories.createCoreService('api::password-history.password-history');
