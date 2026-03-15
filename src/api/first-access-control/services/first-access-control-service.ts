/**
 * first-access-control service
 */

import { factories } from '@strapi/strapi';

// Exporta o handler principal do módulo first-access-control.
export default factories.createCoreService('api::first-access-control.first-access-control');
