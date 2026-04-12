import type { Core } from '@strapi/strapi';

const config: Core.Config.Api = {
  rest: {
    prefix: '',
    defaultLimit: 25,
    maxLimit: 100,
    withCount: true,
  },
};

export default config;
