// Service do módulo Municipe: implementa regras de negócio para histórico de senhas e regras de reutilização.
// Depende de: bcrypt (validação de senha); document API do Strapi.

import bcrypt from 'bcryptjs';

export async function getLastPasswordHashes(strapi: any, userId: any, limit = 3) {
  return strapi.documents('api::password-history.password-history').findMany({
    filters: { user: { id: userId as any } },
    sort: { createdAt: 'desc' },
    pageSize: limit,
  });
}

export async function storePasswordHash(strapi: any, userId: any, hash: string) {
  await strapi.documents('api::password-history.password-history').create({
    data: { user: userId, passwordHash: hash }
  });

  // Mantenha apenas as 3 últimas
  const all = await getLastPasswordHashes(strapi, userId, 10);
  // Executa rotina de histórico de senhas e regras de reutilização.
  if (all.length > 3) {
    // Executa rotina de histórico de senhas e regras de reutilização.
    for (let i = 3; i < all.length; ++i) {
      await strapi.documents('api::password-history.password-history').delete({
        documentId: all[i].id || all[i].documentId
      });
    }
  }
}

export async function checkPasswordReuse(strapi: any, userId: any, plain: string) {
  const histories = await getLastPasswordHashes(strapi, userId, 3);
  // Executa rotina de histórico de senhas e regras de reutilização.
  for (const row of histories) {
    if (await bcrypt.compare(plain, row.passwordHash)) {
      return true;
    }
  }
  return false;
}