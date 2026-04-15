import type { Core } from '@strapi/strapi';
import { TokenRevocationService } from '../services/token-revocation.service';

export default (config, { strapi }: { strapi: Core.Strapi }) => {
  const revocationService = new TokenRevocationService(strapi);

  return async (ctx, next) => {
    const authHeader = ctx.request.header.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      // Verificar se o token foi revogado
      const isRevoked = await revocationService.isRevoked(token);

      if (isRevoked) {
        return ctx.unauthorized('Sessão inválida ou encerrada. Por favor, faça login novamente.');
      }
    }

    await next();
  };
};
