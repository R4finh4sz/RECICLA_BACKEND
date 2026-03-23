// Recebe { email, code } no corpo da requisição, valida os dados, normaliza o email,
// verifica o token de confirmação armazenado (parsing e validade)
// não vaza informação sensível (retorna mensagem genérica).
import { ZodError } from 'zod';
import {
  ConfirmEmailCodeSchema,
  type ConfirmEmailCodeInput,
} from '../validation/ConfirmEmailCodeSchema';
import { parseEmailConfirmationToken } from './helpers/email-confirmation-code';

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let payload: ConfirmEmailCodeInput;

    // Se falhar com ZodError, retorna 400 com mensagem genérica.
    try {
      payload = ConfirmEmailCodeSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) return ctx.badRequest('Dados inválidos.');
      throw err;
    }

    // Normaliza o email: remove espaços e converte para minúsculas
    const email = payload.email.trim().toLowerCase();

    // Busca o usuário pelo email. Seleciona apenas campos necessários para evitar exposição de dados.
    // Também popula o role apenas com o campo name (para validação do tipo de usuário).
    const user = await strapi.documents('plugin::users-permissions.user').findFirst({
      filters: { email },
      fields: ['id', 'documentId', 'email', 'confirmed', 'confirmationToken'],
      populate: { role: { fields: ['name'] } },
    });

    // Se não existir usuário, considera código inválido/expirado (não vaza informação)
    if (!user) return ctx.badRequest('Código inválido ou expirado.');

    // role pode vir populado como objeto { name } ou apenas como string; lida com ambos.
    const roleName = (user as any).role?.name || (user as any).role;
    // Só usuários do tipo 'Municipe' podem confirmar por esse endpoint.
    if (roleName !== 'Municipe') return ctx.badRequest('Código inválido ou expirado.');

    // Se usuário já estiver confirmado, devolve sucesso imediato (idempotência).
    if ((user as any).confirmed === true) {
      return { confirmed: true };
    }

    // Regra: máximo 5 tentativas a cada 10 minutos por usuário.
    const userId = (user as any).id;
    // Busca o documento de segurança do usuário ou cria se não existir.
    const security =
      (await strapi.documents('api::auth-security.auth-security').findFirst({
        filters: { user: { id: userId } },
      })) ||
      (await strapi.documents('api::auth-security.auth-security').create({
        data: { user: userId },
      }));

    const now = new Date();
    const windowMs = 10 * 60 * 1000; // janela de 10 minutos em ms

    // Usa o campo emailConfirmAttemptsWindowStart para marcar o início da janela.
    const startValue = (security as any).emailConfirmAttemptsWindowStart;
    const start = startValue ? new Date(startValue) : null;

    // Conta de tentativas na janela atual. Se janela expirada, zera as tentativas.
    let attempts = Number((security as any).emailConfirmAttemptsCount || 0);
    if (!start || now.getTime() - start.getTime() >= windowMs) attempts = 0;

    // Se excedeu o limite, retorna 429 (Too Many Requests).
    if (attempts >= 5) {
      ctx.status = 429;
      ctx.body = { error: 'Muitas tentativas. Tente novamente mais tarde.' };
      return;
    }

    // parseEmailConfirmationToken deve retornar null/undefined se inválido, ou objeto { code, expiresAt }.
    const parsed = parseEmailConfirmationToken((user as any).confirmationToken);
    if (!parsed) {
      // Incrementa contador de tentativas e define start da janela (se necessário).
      await strapi.documents('api::auth-security.auth-security').update({
        documentId: String((security as any).documentId || (security as any).id),
        data: {
          emailConfirmAttemptsCount: attempts + 1,
          // Mantém a data de início anterior se existir, caso contrário usa agora.
          emailConfirmAttemptsWindowStart: start ? start.toISOString() : now.toISOString(),
        },
      });
      // Não informa detalhes sobre o motivo (segurança).
      return ctx.badRequest('Código inválido ou expirado.');
    }

    // Se o código enviado não bater com o token armazenado, incrementa tentativas e rejeita.
    if (parsed.code !== payload.code) {
      await strapi.documents('api::auth-security.auth-security').update({
        documentId: String((security as any).documentId || (security as any).id),
        data: {
          emailConfirmAttemptsCount: attempts + 1,
          emailConfirmAttemptsWindowStart: start ? start.toISOString() : now.toISOString(),
        },
      });
      return ctx.badRequest('Código inválido ou expirado.');
    }

    // Se o token expirou (comparação por timestamp), incrementa tentativas e rejeita.
    if (Date.now() > parsed.expiresAt) {
      await strapi.documents('api::auth-security.auth-security').update({
        documentId: String((security as any).documentId || (security as any).id),
        data: {
          emailConfirmAttemptsCount: attempts + 1,
          emailConfirmAttemptsWindowStart: start ? start.toISOString() : now.toISOString(),
        },
      });
      return ctx.badRequest('Código inválido ou expirado.');
    }

    // Marca o usuário como confirmado e limpa o confirmationToken.
    await strapi.documents('plugin::users-permissions.user').update({
      documentId: String((user as any).documentId || (user as any).id),
      data: {
        confirmed: true,
        confirmationToken: null,
      },
    });

    // Ao confirmar com sucesso, zera o rate limit para esse tipo de tentativa.
    await strapi.documents('api::auth-security.auth-security').update({
      documentId: String((security as any).documentId || (security as any).id),
      data: {
        emailConfirmAttemptsCount: 0,
        emailConfirmAttemptsWindowStart: null,
      },
    });

    // Retorna sucesso explícito.
    return { confirmed: true };
  },
});