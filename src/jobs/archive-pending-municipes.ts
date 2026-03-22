import type { Core } from '@strapi/strapi';

function hoursToMs(h: number) {
  return h * 60 * 60 * 1000;
}

export async function archivePendingMunicipes(strapi: Core.Strapi) {
  const now = Date.now();
  const cutoff = new Date(now - hoursToMs(48)).toISOString();

  const pending = await strapi.documents('api::municipe.municipe').findMany({
    filters: {
      statusCadastro: { $eq: 'AGUARDANDO_VALIDACAO' },
      createdAt: { $lte: cutoff },
    },
    fields: ['id', 'documentId', 'createdAt'],
    populate: { user: { fields: ['id', 'documentId', 'blocked'] } },
    pageSize: 500,
  });

  if (!pending || pending.length === 0) return;

  for (const m of pending as any[]) {
    const municipeDocumentId = String(m.documentId || m.id);

    await strapi.documents('api::municipe.municipe').update({
      documentId: municipeDocumentId,
      data: {
        statusCadastro: 'ARQUIVADO',
        arquivadoEm: new Date().toISOString(),
      },
    });

    const user = m.user;
    if (user) {
      const userDocumentId = String(user.documentId || user.id);
      await strapi.documents('plugin::users-permissions.user').update({
        documentId: userDocumentId,
        data: { blocked: true },
      });
    }
  }

  strapi.log.info(`[cron] Archived ${pending.length} pending Municipe records older than 48h.`);
}