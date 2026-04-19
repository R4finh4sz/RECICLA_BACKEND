import bcrypt from 'bcryptjs';
import { ZodError } from 'zod';
import { DeleteAccountSchema, type DeleteAccountInput } from '../validation/DeleteAccountSchema';
import { getUserRoleName } from './helpers/get-user-role-name';
import { deriveSaltFromUser } from './helpers/derive-salt';
import { TokenRevocationService } from './token-revocation.service';

async function deleteByUserRelation(strapi: any, uid: string, userId: number | string) {
  const docs = await strapi.documents(uid).findMany({
    filters: { user: { id: userId as any } },
    fields: ['id', 'documentId'],
  });

  for (const doc of docs || []) {
    await strapi.documents(uid).delete({
      documentId: String((doc as any).documentId || (doc as any).id),
    });
  }
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized('Credenciais invalidas.');

    const roleName = getUserRoleName(ctx);
    if (roleName !== 'Municipe') return ctx.forbidden('Apenas Municipe.');

    let data: DeleteAccountInput;
    try {
      data = DeleteAccountSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) {
        return ctx.badRequest('Dados invalidos para exclusao da conta.', { details: err.issues });
      }
      throw err;
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId as any },
      populate: ['role'],
    });

    if (!user || !user.password) return ctx.badRequest('Credenciais invalidas.');
    if ((user as any)?.role?.name !== 'Municipe') return ctx.forbidden('Apenas Municipe.');

    let currentPasswordOk = await bcrypt.compare(data.currentPassword, user.password);
    if (!currentPasswordOk) {
      const userDoc = await strapi.documents('plugin::users-permissions.user').findFirst({
        filters: { id: user.id as any },
      });
      const derived = deriveSaltFromUser(userDoc);
      if (derived) {
        currentPasswordOk = await bcrypt.compare(data.currentPassword + '::' + derived, user.password);
      }
    }

    if (!currentPasswordOk) return ctx.badRequest('Credenciais invalidas.');

    await deleteByUserRelation(strapi, 'api::term-list.term-list', userId);
    await deleteByUserRelation(strapi, 'api::auth-security.auth-security', userId);
    await deleteByUserRelation(strapi, 'api::first-access-control.first-access-control', userId);
    await deleteByUserRelation(strapi, 'api::municipe.municipe', userId);

    await strapi.db.query('plugin::users-permissions.user').delete({
      where: { id: userId as any },
    });

    const authHeader = String(ctx?.request?.header?.authorization || '');
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const revocationService = new TokenRevocationService(strapi);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 2);
        await revocationService.revoke(token, expiresAt);
      }
    }

    return { deleted: true };
  },
});
