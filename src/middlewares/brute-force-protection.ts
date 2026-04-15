import type { Core } from '@strapi/strapi';
import { BruteForceService } from '../services/brute-force.service';

export default (config, { strapi }: { strapi: Core.Strapi }) => {
  const bruteForceService = new BruteForceService(strapi);

  return async (ctx, next) => {
    // Aplicar apenas em rotas de autenticação
    const isLoginRoute = ctx.path.includes('/auth/local');
    
    if (!isLoginRoute) {
      return await next();
    }

    const ip = ctx.ip;
    const identifier = ctx.request.body?.identifier || ip;

    // Verificar se já está bloqueado
    const isBlocked = await bruteForceService.isBlocked(identifier);
    if (isBlocked) {
      return ctx.tooManyRequests('Sua conta ou IP estão temporariamente bloqueados devido a muitas tentativas falhas. Tente novamente em 15 minutos.');
    }

    try {
      await next();

      // Se chegamos aqui e o status é 200, sucesso no login
      if (ctx.status === 200) {
        await bruteForceService.recordAttempt(identifier, true);
      } else if (ctx.status === 400 || ctx.status === 401) {
        // Falha no login (credenciais erradas)
        const result = await bruteForceService.recordAttempt(identifier, false);
        
        if (result.blocked) {
           return ctx.tooManyRequests('Muitas tentativas falhas. Bloqueado por 15 minutos.');
        }

        if (result.delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, result.delayMs));
        }
      }
    } catch (err) {
      // Caso haja erro, também contamos como falha se for erro de validação/auth
      await bruteForceService.recordAttempt(identifier, false);
      throw err;
    }
  };
};
