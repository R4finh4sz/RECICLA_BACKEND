// Cron do Strapi v5.
// Eu implementei aqui a RN [3.4.20]:
// cadastro fica aguardando validação por até 48 horas; depois disso, arquiva automaticamente.

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

export default {
  // A cada 1 hora
  '0 * * * *': async ({ strapi }: { strapi: any }) => {
    const cutoff = hoursAgo(48);

    try {
      const pageSize = 200;
      let page = 1;

      while (true) {
        const rows = await strapi.documents('api::municipe.municipe').findMany({
          filters: {
            statusCadastro: { $eq: 'AGUARDANDO_VALIDACAO' },
            createdAt: { $lte: cutoff.toISOString() },
          },
          fields: ['id', 'documentId', 'createdAt', 'statusCadastro', 'user'],
          populate: { user: { fields: ['id', 'documentId'] } },
          page,
          pageSize,
          sort: { createdAt: 'asc' },
        });

        if (!rows || rows.length === 0) break;

        for (const m of rows) {
          const docId = String((m as any).documentId || (m as any).id);

          await strapi.documents('api::municipe.municipe').update({
            documentId: docId,
            data: {
              statusCadastro: 'ARQUIVADO',
              arquivadoEm: new Date().toISOString(),
              motivoArquivamento: 'Cadastro arquivado automaticamente após 48 horas sem validação.',
            },
          });

          // Eu bloqueio o usuário para garantir que não tenha acesso.
          const user = (m as any).user;
          if (user?.id || user?.documentId) {
            await strapi.documents('plugin::users-permissions.user').update({
              documentId: String(user.documentId || user.id),
              data: { blocked: true },
            });
          }
        }

        page += 1;
      }

      strapi.log.info('[cron] Arquivamento automático (48h) executado.');
    } catch (err) {
      strapi.log.error(`[cron] Erro no arquivamento automático (48h): ${String(err)}`);
    }
  },
};