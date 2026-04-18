// Service do módulo Municipe: implementa regras de negócio para troca de senha do usuário autenticado.
// Depende de: bcrypt (validação de senha); Zod (validação de dados); Users & Permissions (usuários/roles).

import bcrypt from 'bcryptjs';
import { ZodError } from 'zod';
import { ChangePasswordSchema, ChangePasswordInput } from '../validation/ChangePasswordSchema';
import { getUserRoleName } from './helpers/get-user-role-name';
import { deriveSaltFromUser } from './helpers/derive-salt';

// Exporta o handler principal do módulo Municipe.
export default ({ strapi }: { strapi: any }) => ({
  // Executa rotina de troca de senha do usuário autenticado.
  async execute(ctx: any) {
    // 1. Obtém o ID do usuário autenticado via JWT
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized('Credenciais inválidas.');

    // 2. Valida se o usuário tem o papel correto
    const roleName = getUserRoleName(ctx);
    if (roleName !== 'Municipe') return ctx.forbidden('Apenas Municipe.');

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
    if (dbRoleName !== 'Municipe')
      return ctx.forbidden('Apenas Municipe.');

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

    // 8. Atualiza a senha no próprio Strapi
    const userService = strapi.plugin('users-permissions').service('user') as any;
    const updateUser =
      userService.update?.bind(userService) ||
      userService.edit?.bind(userService);

    // Executa rotina de troca de senha do usuário autenticado.
    if (!updateUser) {
      return ctx.badRequest(
        'Serviço users-permissions.user não expõe update/edit.'
      );
    }

    // enviar a senha com derived salt (se disponível) para que o Strapi faça o hash normalmente
    const derivedForNew = deriveSaltFromUser(user as any);
    const toSavePassword = derivedForNew ? data.newPassword + '::' + derivedForNew : data.newPassword;

    await updateUser(userId, { password: toSavePassword });

    // 9. Retorna sucesso: padrão
    return { changed: true };
  },
});