import crypto from 'node:crypto';

function sha256(text: string) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// Desativa outros termos para garantir que apenas um seja o "Ativo"
async function deactivateOtherTerms(currentDocumentId: string) {
  await strapi.db.query('api::termo.termo').updateMany({
    where: {
      active: true,
      documentId: { $ne: currentDocumentId },
    },
    data: {
      active: false,
    },
  });
}

// Obriga todos os usuários (Municipes) a aceitarem o novo termo ativo
async function resetAllUserTerms() {
  await strapi.db.query('api::first-access-control.first-access-control').updateMany({
    where: {
      mustAcceptTerms: false,
    },
    data: {
      mustAcceptTerms: true,
    },
  });
  strapi.log.info('FAC Reset: Todos os usuários agora precisam aceitar o novo termo ativo.');
}

export default {
  async beforeCreate(event: any) {
    const data = event.params.data || {};
    // Garante a geração do Hash na criação do termo
    if (typeof data.content === 'string') {
      data.contentHash = sha256(data.content);
    }
  },

  async beforeUpdate(event: any) {
    const { data, where } = event.params;

    // Se o conteúdo foi modificado, gera novo hash
    if (data && typeof data.content === 'string') {
      data.contentHash = sha256(data.content);
    } else if (where) {
      // Se o conteúdo não veio no 'data' (ex: mudou só o status para 'Ativo'), 
      // busca o conteúdo atual para manter o hash íntegro no banco
      const existing = await strapi.db.query('api::termo.termo').findOne({ where });
      if (existing && typeof existing.content === 'string') {
        event.params.data.contentHash = sha256(existing.content);
      }
    }
  },

  async afterCreate(event: any) {
    const result = event.result;
    // Se o novo termo já for criado como Ativo, desativa os outros e reseta usuários
    if (result?.active && result?.documentId) {
      await deactivateOtherTerms(result.documentId);
      await resetAllUserTerms();
    }
  },

  async afterUpdate(event: any) {
    const result = event.result;
    // Sempre que um termo for marcado como Ativo, garante a exclusividade e o reset
    if (result?.active && result?.documentId) {
      await deactivateOtherTerms(result.documentId);
      await resetAllUserTerms();
    }
  },
};