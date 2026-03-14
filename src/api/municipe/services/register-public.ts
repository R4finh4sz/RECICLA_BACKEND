import { ZodError } from 'zod';
import {
  RegisterMunicipePublicSchema,
  type RegisterMunicipePublicInput,
} from '../validation/RegisterMunicipePublicSchema';
import { sendEmail } from './helpers/send-email';
import {
  buildEmailConfirmationToken,
  generateEmailConfirmationCode,
} from './helpers/email-confirmation-code';

async function getRoleIdByName(strapi: any, name: string) {
  const role = await strapi.documents('plugin::users-permissions.role').findFirst({
    filters: { name },
    fields: ['id', 'name'],
  });

  if (!role) throw new Error(`Role "${name}" não encontrada`);
  return role.id;
}

function isProfileComplete(data: RegisterMunicipePublicInput) {
  return Boolean(data.endereco && data.cep && data.cidade && data.estado && data.telefone);
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let payload: RegisterMunicipePublicInput;
    try {
      const body = ctx?.request?.body?.data || ctx?.request?.body || {};
      payload = RegisterMunicipePublicSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        ctx.status = 400;
        ctx.body = {
          error: 'Dados inválidos para cadastro.',
          details: err.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        };
        return;
      }
      throw err;
    }

    const email = payload.email.trim().toLowerCase();
    const username = payload.username?.trim() || email;

    const existingUser = await strapi.documents('plugin::users-permissions.user').findFirst({
      filters: { email },
      fields: ['id', 'email'],
    });
    if (existingUser) return ctx.badRequest('Já existe uma conta com este e-mail.');

    const existingMunicipe = await strapi.documents('api::municipe.municipe').findFirst({
      filters: { cpf: payload.cpf },
      fields: ['id', 'cpf'],
    });
    if (existingMunicipe) return ctx.badRequest('Já existe um municipe com este CPF.');

    const municipeRoleId = await getRoleIdByName(strapi, 'Municipe');

    const userService = strapi.plugin('users-permissions').service('user') as any;
    const createUser = userService.create?.bind(userService) || userService.add?.bind(userService);
    if (!createUser) {
      return ctx.badRequest('Service users-permissions.user não expõe create/add.');
    }

    const createdUser = await createUser({
      email,
      username,
      password: payload.password,
      confirmed: false,
      blocked: false,
      role: municipeRoleId,
      provider: 'local',
    });

    const confirmationCode = generateEmailConfirmationCode();
    const confirmationToken = buildEmailConfirmationToken(confirmationCode);
    await strapi.documents('plugin::users-permissions.user').update({
      documentId: String((createdUser as any).documentId || (createdUser as any).id),
      data: { confirmationToken },
    });

    const createdMunicipe = await strapi.documents('api::municipe.municipe').create({
      data: {
        nome: payload.nome,
        cpf: payload.cpf,
        estado: payload.estado,
        endereco: payload.endereco,
        complemento: payload.complemento,
        cep: payload.cep,
        cidade: payload.cidade,
        telefone: payload.telefone,
        user: createdUser.id,
      },
      fields: ['id', 'documentId'],
    });

    await strapi.documents('api::first-access-control.first-access-control').create({
      data: {
        user: createdUser.id,
        mustCompleteProfile: !isProfileComplete(payload),
        mustAcceptTerms: true,
        mustChangePassword: false,
      },
    });

    try {
      await sendEmail(strapi, {
        to: createdUser.email,
        subject: 'Recicla+ - Confirme seu e-mail',
        text:
          `Olá, ${payload.nome}!\n\n` +
          `Seu código de confirmação é: ${confirmationCode}\n\n` +
          `Ele expira em 10 minutos.\n\n` +
          `Se você não solicitou este cadastro, ignore este e-mail.`,
      });
    } catch (err) {
      strapi.log.warn(`[register-public] falha ao enviar confirmação de e-mail: ${String(err)}`);
    }

    return {
      municipeId: (createdMunicipe as any).id,
      userId: createdUser.id,
      email: createdUser.email,
      requiresEmailConfirmation: true,
    };
  },
});
