import type { Core } from '@strapi/strapi';

const RESERVED_PREFIXES = [
  '/api',
  '/admin',
  '/users-permissions',
  '/uploads',
  '/documentation',
  '/content-manager',
  '/content-type-builder',
  '/i18n',
  '/_health',
] as const;

const STATIC_FILE_RE = /\.[a-zA-Z0-9]+$/;

export default (_config: unknown, _context: { strapi: Core.Strapi }) => {
  return async (ctx: { path: string; method: string }, next: () => Promise<void>) => {
    const { path } = ctx;

    const isReserved = RESERVED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    const isRoot = path === '/';
    const isStaticFile = STATIC_FILE_RE.test(path);

    if (!isReserved && !isRoot && !isStaticFile) {
      ctx.path = `/api${path}`;
    }

    await next();
  };
};
