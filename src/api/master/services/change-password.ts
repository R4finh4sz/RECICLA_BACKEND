// Service do módulo Master: implementa regras de negócio para troca de senha do usuário autenticado.
// Depende de: bcrypt (validação de senha); Zod (validação de dados); Users & Permissions (usuários/roles).

import bcrypt from 'bcryptjs';
import { ZodError } from 'zod';
import { ChangePasswordSchema, ChangePasswordInput } from '../validation/ChangePasswordSchema';
import { getUserRoleName } from './helpers/get-user-role-name';
import { deriveSaltFromUser } from './helpers/derive-salt';
import { hashPassword } from '../../../utils/password-hash';
import { TokenRevocationService } from './token-revocation.service';

// Exporta o handler principal do módulo Master.
export default ({ strapi }: { strapi: any }) => ({
  // Executa rotina de troca de senha do usuário autenticado.
  async execute(ctx: any) {
    // 1. Obtém o ID do usuário autenticado via JWT
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized('Credenciais inválidas.');

    // 2. Valida se o usuário tem o papel correto
    const roleName = getUserRoleName(ctx);
    if (roleName !== 'Master') return ctx.forbidden('Apenas Master.');

    // 3. Valida payload (Zod)
    let data: ChangePasswordInput;
    try {
      data = ChangePasswordSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError)
        return ctx.badRequest('As senhas não conferem ou não seguem os requisitos.');
      throw err;
    }

    // 4. Busca usuário no banco com password e role
    const user = await strapi
      .documents('plugin::users-permissions.user')
      .findFirst({
        filters: { id: userId as any },
        fields: ['id', 'password', 'email', 'username'],
        populate: { role: { fields: ['name'] } },
      });
    if (!user) return ctx.notFound('Usuário não encontrado.');

    const dbRoleName = (user as any)?.role?.name;
    if (dbRoleName !== 'Master')
      return ctx.forbidden('Apenas Master.');

    // 5. Confere senha atual (bcrypt)
    const hashed = (user as any).password;
    // Executa rotina de troca de senha do usuário autenticado.
    if (!hashed) {
      // Se usuário não tem hash, não era para permitir login — segurança
      return ctx.badRequest('Credenciais inválidas.');
    }

    // tenta forma antiga (senha pura)
    let contrasenhaOk = await bcrypt.compare(data.currentPassword, hashed);

    // se não bateu, tenta com derived salt (senha::salt)
    if (!contrasenhaOk) {
      const derived = deriveSaltFromUser(user as any);
      if (derived) {
        contrasenhaOk = await bcrypt.compare(data.currentPassword + '::' + derived, hashed);
      }
    }

    // Executa rotina de troca de senha do usuário autenticado.
    if (!contrasenhaOk) {
      // Resposta sempre neutra — NUNCA diz se a senha atual está errada
      return ctx.badRequest('Credenciais inválidas.');
    }

    // 8. Atualiza a senha com hash configurável
    const derivedForNew = deriveSaltFromUser(user as any);
    const toSavePassword = derivedForNew ? data.newPassword + '::' + derivedForNew : data.newPassword;
    const passwordHash = await hashPassword(toSavePassword);

    await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: userId as any },
      data: { password: passwordHash },
    });

    // 9. Invalida tokens: atualiza auth-security.tokenInvalidBefore e revoga token atual
    try {
      const now = new Date().toISOString();
      const authSec = await strapi.documents('api::auth-security.auth-security').findFirst({
        filters: { user: { id: userId as any } },
      });

      if (authSec) {
        await strapi.documents('api::auth-security.auth-security').update({
          documentId: String((authSec as any).documentId || (authSec as any).id),
          data: { tokenInvalidBefore: now },
        });
      } else {
        await strapi.documents('api::auth-security.auth-security').create({
          data: { user: userId, tokenInvalidBefore: now },
        });
      }

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
    } catch (err) {
      strapi.log.error('[change-password] falha ao invalidar tokens após troca de senha', err);
    }

    // 10. Retorna sucesso: padrão
    return { changed: true };
  },
});