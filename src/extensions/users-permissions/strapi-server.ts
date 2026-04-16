import type { Core } from '@strapi/strapi';
import { TokenRevocationService } from '../../services/token-revocation.service';

export default (plugin: Core.Plugin) => {
  const revocationService = new TokenRevocationService(strapi);

  plugin.controllers.auth.logout = async (ctx, next) => {
    const authHeader = ctx.request.header.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.badRequest('No token provided');
    }

    const token = authHeader.split(' ')[1];


    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 2);

    await revocationService.revoke(token, expiresAt);

    ctx.send({
      message: 'Successfully logged out and token invalidated',
    });
  };

  const originalCallback = plugin.controllers.auth.callback;
  plugin.controllers.auth.callback = async (ctx, next) => {
    await originalCallback(ctx, next);

    const body = ctx.body as any;
    if (ctx.status === 200 && body && body.user) {
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: body.user.id },
        populate: ['role'],
      });

      if (user && user.role) {
        body.user.role = {
          id: user.role.id,
          name: user.role.name,
          description: user.role.description,
          type: user.role.type,
        };
      }
    }
  };
  const originalMe = plugin.controllers.user.me;
  plugin.controllers.user.me = async (ctx, next) => {
    await originalMe(ctx, next);

    const user = ctx.body as any;
    if (user && user.id) {
      const municipe = await strapi.documents('api::municipe.municipe').findFirst({
        filters: { user: { id: user.id } },
        fields: ['acceptedTerms']
      }) as any;

      user.acceptedTerms = municipe ? !!municipe.acceptedTerms : false;

      const userWithRole = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: user.id },
        populate: ['role'],
      });
      if (userWithRole && userWithRole.role) {
        user.role = {
          id: userWithRole.role.id,
          name: userWithRole.role.name,
          type: userWithRole.role.type,
        };
      }
    }
  };

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
