import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  cron: {
    enabled: env.bool('CRON_ENABLED', true),
    tasks: {
      archivePendingMunicipes: {
        task: async ({ strapi }: { strapi: Core.Strapi }) => {
          const job = await import('../src/jobs/archive-pending-municipes');
          await job.archivePendingMunicipes(strapi);
        },
        options: {
          rule: '*/10 * * * *',
        },
      },
    },
  },
});

export default config;