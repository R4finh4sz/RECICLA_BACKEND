import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'global::remove-api-prefix',
  'strapi::errors',
  'global::force-https',
  {
    name: 'strapi::security',
    config: {
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    },
  },
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'global::brute-force-protection',
  'global::auth-checker',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
