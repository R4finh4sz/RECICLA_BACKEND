import type { Core } from '@strapi/strapi';
import { TokenRevocationService } from '../api/municipe/services/token-revocation.service';

function base64urlDecode(str: string) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

export default (config, { strapi }: { strapi: Core.Strapi }) => {
  const revocationService = new TokenRevocationService(strapi);

  return async (ctx, next) => {
    const authHeader = ctx.request.header.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      // Verificar se o token foi revogado explicitamente
      const isRevoked = await revocationService.isRevoked(token);
      if (isRevoked) {
        return ctx.unauthorized('Sessão inválida ou encerrada. Por favor, faça login novamente.');
      }

      // Decodifica payload do JWT sem verificar assinatura (apenas para iat/id)
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(base64urlDecode(parts[1]));
          const iat = payload?.iat;
          const userId = payload?.id ?? payload?.sub ?? null;

          if (userId && iat) {
            const authSec = await strapi.documents('api::auth-security.auth-security').findFirst({
              filters: { user: { id: userId as any } },
              fields: ['tokenInvalidBefore'],
            });

            const tokenInvalidBefore = authSec?.tokenInvalidBefore ? new Date(authSec.tokenInvalidBefore).getTime() : null;
            const tokenIatMs = Number(iat) * 1000;

            if (tokenInvalidBefore && tokenIatMs < tokenInvalidBefore) {
              return ctx.unauthorized('Sessão expirada após alteração de credenciais. Faça login novamente.');
            }
          }
        }
      } catch (err) {
        strapi.log.warn('[auth-checker] falha ao decodificar JWT para verificação de tokenInvalidBefore', err);
      }
    }

    await next();
  };
};
