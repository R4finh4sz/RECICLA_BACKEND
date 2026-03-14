// Controller do módulo trusted-device: recebe requisições HTTP e delega regras de negócio.
// Depende de: entityService do Strapi para operações CRUD em dispositivos confiáveis.

import { factories } from '@strapi/strapi';

// Exporta o handler principal do módulo trusted-device.
export default factories.createCoreController('api::trusted-device.trusted-device', ({ strapi }) => ({
  // Executa rotina de gestão de dispositivos confiáveis do usuário.
  async disconnect(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Não autenticado.');

    const { id } = ctx.params;
    if (!id) return ctx.badRequest('ID do dispositivo ausente.');

    // Força o tipo para acesso a .user
    const device = await strapi.entityService.findOne('api::trusted-device.trusted-device', id, {
      populate: { user: true }
    }) as any; // usa 'as any' para que TypeScript não barre acesso

    if (!device) return ctx.notFound('Dispositivo não encontrado.');

    let deviceUserId: string | number | undefined;
    // Executa rotina de gestão de dispositivos confiáveis do usuário.
    if (device.user && typeof device.user === 'object' && 'id' in device.user) {
      deviceUserId = device.user.id;
    } else if (device.user) {
      deviceUserId = device.user;
    }

    if (!deviceUserId || String(deviceUserId) !== String(user.id)) {
      return ctx.forbidden('Você não pode desconectar este dispositivo.');
    }

    await strapi.entityService.delete('api::trusted-device.trusted-device', id);

    ctx.body = { message: 'Dispositivo desconectado com sucesso.' };
  },
}));