import type { Core } from '@strapi/strapi';

function isTruthy(value: string | undefined) {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function isSecureRequest(ctx: any) {
  if (ctx.secure) return true;

  const xfProto = String(ctx.request.header['x-forwarded-proto'] || '').toLowerCase();
  if (xfProto === 'https') return true;

  const frontEndHttps = String(ctx.request.header['front-end-https'] || '').toLowerCase();
  if (frontEndHttps === 'on') return true;

  return false;
}

export default (_config: unknown, _context: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const isProd = process.env.NODE_ENV === 'production';
    const forceHttps = isTruthy(process.env.FORCE_HTTPS) || (process.env.FORCE_HTTPS == null && isProd);

    if (!forceHttps || isSecureRequest(ctx)) {
      await next();
      return;
    }

    const host = String(ctx.request.header.host || '');
    const targetUrl = `https://${host}${ctx.url}`;

    if (ctx.method === 'GET' || ctx.method === 'HEAD') {
      ctx.status = 308;
      ctx.redirect(targetUrl);
      return;
    }

    ctx.status = 426;
    ctx.body = {
      error: 'HTTPS Required',
      message: 'Esta rota exige TLS/HTTPS. Utilize endpoint em https://',
    };
  };
};
