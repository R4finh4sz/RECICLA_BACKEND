// Schema do módulo termo: definição de estrutura e relações de dados.
// Depende de: document API do Strapi.

import crypto from 'node:crypto';

function sha256(text: string) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

async function deactivateOtherTerms(currentIdOrDocumentId: any) {
  const others = await strapi.documents('api::termo.termo').findMany({
    filters: {
      active: { $eq: true },
      documentId: { $ne: String(currentIdOrDocumentId) },
    },
    fields: ['documentId'],
  });

  await Promise.all(
    (others || []).map((t: any) =>
      strapi.documents('api::termo.termo').update({
        documentId: String(t.documentId),
        data: { active: false },
      })
    )
  );
}

// Exporta o handler principal do módulo termo.
export default {
  async beforeCreate(event: any) {
    const data = event.params.data || {};
    if (typeof data.content === 'string') data.contentHash = sha256(data.content);
    event.params.data = data;
  },

  async beforeUpdate(event: any) {
    const data = event.params.data || {};
    if (typeof data.content === 'string') data.contentHash = sha256(data.content);
    event.params.data = data;
  },

  async afterCreate(event: any) {
    const result = event.result;
    if (result?.active) {
      await deactivateOtherTerms(result.documentId || result.id);
    }
  },

  async afterUpdate(event: any) {
    const result = event.result;
    if (result?.active) {
      await deactivateOtherTerms(result.documentId || result.id);
    }
  },
};