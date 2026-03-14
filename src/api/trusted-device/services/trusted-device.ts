// Service do módulo trusted-device: implementa regras de negócio para gestão de dispositivos confiáveis do usuário.

import { factories } from '@strapi/strapi';

// Exporta o handler principal do módulo trusted-device.
export default factories.createCoreService('api::trusted-device.trusted-device', ({ strapi }) => ({
  // Função customizada
  async registerOrUpdate({ user, ip, userAgent }) {
    const now = new Date().toISOString();

    let device = await strapi.db.query('api::trusted-device.trusted-device').findOne({
      where: { user: user, ip, userAgent },
    });

    // Executa rotina de gestão de dispositivos confiáveis do usuário.
    if (!device) {
      device = await strapi.db.query('api::trusted-device.trusted-device').create({
        data: { user, ip, userAgent, firstSeenAt: now, lastSeenAt: now, timesSeen: 1 },
      });
      return { device, isNew: true };
    } else {
      await strapi.db.query('api::trusted-device.trusted-device').update({
        where: { id: device.id },
        data: {
          lastSeenAt: now,
          timesSeen: (device.timesSeen || 1) + 1,
        },
      });
      return { device, isNew: false };
    }
  },
}));