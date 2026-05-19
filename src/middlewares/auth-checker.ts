import type { Core } from '@strapi/strapi';
import { TokenRevocationService } from '../api/municipe/services/token-revocation.service';

export default (config, { strapi }: { strapi: Core.Strapi }) => {
  const revocationService = new TokenRevocationService(strapi);

  return async (ctx, next) => {
    const authHeader = ctx.request.header.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      try {
        // Decodificar o JWT manualmente (sem validação de assinatura neste ponto)
        const parts = token.split('.');
        if (parts.length !== 3) {
          return ctx.unauthorized('Token inválido.');
        }

        // Base64url decode
        const base64urlDecode = (str: string) => {
          let output = str.replace(/-/g, '+').replace(/_/g, '/');
          switch (output.length % 4) {
            case 0:
              break;
            case 2:
              output += '==';
              break;
            case 3:
              output += '=';
              break;
            default:
              throw new Error('Invalid base64url');
          }
          return Buffer.from(output, 'base64').toString('utf-8');
        };

        const payload = JSON.parse(base64urlDecode(parts[1]));
        const tokenIat = payload.iat;

        if (!tokenIat) {
          return ctx.unauthorized('Token inválido.');
        }

        // Verificar se o token foi revogado
        const isRevoked = await revocationService.isRevoked(token);

        if (isRevoked) {
          return ctx.unauthorized('Sessão inválida ou encerrada. Por favor, faça login novamente.');
        }

        // Verificar tokenInvalidBefore
        const userId = payload.id;
        if (userId) {
          const authSecurity = await strapi
            .documents('api::auth-security.auth-security')
            .findFirst({
              filters: { user: { id: userId as any } },
            });

          if (authSecurity && (authSecurity as any).tokenInvalidBefore) {
            const invalidateBeforeTimestamp = Math.floor(
              new Date((authSecurity as any).tokenInvalidBefore).getTime() / 1000
            );

            if (tokenIat < invalidateBeforeTimestamp) {
              return ctx.unauthorized('Sessão encerrada. Por favor, faça login novamente.');
            }
          }
        }
      } catch (err: any) {
        strapi.log.warn('[auth-checker] JWT decode error:', err.message);
        // Continuar sem bloquear - deixa o Strapi validar o token normalmente
      }
    }

    await next();
  };
};
