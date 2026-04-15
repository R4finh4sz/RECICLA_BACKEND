import type { Core } from '@strapi/strapi';
import { TokenRevocationService } from '../../services/token-revocation.service';

export default (plugin: Core.Plugin) => {
  const revocationService = new TokenRevocationService(strapi);

  // Adicionar controlador de logout
  plugin.controllers.auth.logout = async (ctx) => {
    const authHeader = ctx.request.header.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.badRequest('No token provided');
    }

    const token = authHeader.split(' ')[1];

    // Aqui poderíamos decodificar o token para pegar a data de expiração real
    // Mas por simplicidade, definimos uma expiração de 2 dias na blacklist
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 2);

    await revocationService.revoke(token, expiresAt);

    ctx.send({
      message: 'Successfully logged out and token invalidated',
    });
  };

  // Adicionar rota de logout
  plugin.routes['content-api'].routes.push({
    method: 'POST',
    path: '/auth/logout',
    handler: 'auth.logout',
    config: {
      prefix: '',
    },
  });

  return plugin;
};
