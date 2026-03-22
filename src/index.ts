// import type { Core } from '@strapi/strapi';
import { archivePendingMunicipes } from './jobs/archive-pending-municipes';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi } /* : { strapi: Core.Strapi } */) {
    const enabled = strapi.config.get('server.cron.enabled');
    if (!enabled) return;

    try {
      await archivePendingMunicipes(strapi);
    } catch (err) {
      strapi.log.error(`[bootstrap] archivePendingMunicipes failed: ${String(err)}`);
    }
  },
};