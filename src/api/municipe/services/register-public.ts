// Service do módulo Municipe: autenticação do munícipe e emissão de JWT.

import { ZodError } from 'zod';
import { RegisterMunicipePublicSchema, type RegisterMunicipePublicInput,} from '../validation/RegisterMunicipePublicSchema';
import { sendEmail } from './helpers/send-email';
import { buildEmailConfirmationToken,generateEmailConfirmationCode,} from './helpers/email-confirmation-code';

function normalizeEmail(v: string) {
  return String(v || '').trim().toLowerCase();
}
;
function normalizeCpf(v: string) {
  return String(v || '').replace(/\D/g, '');
}

function normalizeCep(v: string) {
  return String(v || '').replace(/\D/g, '');
}

function normalizeTelefone(v: string) {
  return String(v || '').replace(/\D/g, '');
}

async function getMunicipeRoleId(strapi: any) {
  const role = await strapi.documents('plugin::users-permissions.role').findFirst({
    filters: { name: 'Municipe' },
    fields: ['id', 'name'],
  });

  return role ? (role as any).id : null;
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let data: RegisterMunicipePublicInput;

    try {
      data = RegisterMunicipePublicSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) return ctx.badRequest('Credenciais inválidas.');
      throw err;
    }

    const email = normalizeEmail(data.email);
    const cpf = normalizeCpf(data.cpf);

    const existingUser = await strapi.documents('plugin::users-permissions.user').findFirst({
      filters: { email },
      fields: ['id', 'email'],
    });

    if (existingUser) return ctx.badRequest('Credenciais inválidas.');

    const existingMunicipeByCpf = await strapi.documents('api::municipe.municipe').findFirst({
      filters: { cpf },
      fields: ['id'],
    });

    if (existingMunicipeByCpf) return ctx.badRequest('Credenciais inválidas.');

    const roleId = await getMunicipeRoleId(strapi);
    if (!roleId) return ctx.badRequest('Credenciais inválidas.');

    const confirmationCode = generateEmailConfirmationCode();
    const confirmationToken = buildEmailConfirmationToken(confirmationCode, Date.now());

    const userService = strapi.plugin('users-permissions').service('user') as any;
    const createUser =
      userService.create?.bind(userService) ||
      userService.add?.bind(userService);

    if (!createUser) return ctx.badRequest('Credenciais inválidas.');

    const createdUser = await createUser({
      email,
      username: (data.username || email.split('@')[0]).trim(),
      password: data.password,
      role: roleId,
      confirmed: false,
      blocked: false,
      confirmationToken,
    });

    const userId = (createdUser as any).id;

    await strapi.documents('api::municipe.municipe').create({
      data: {
        nome: data.nome,
        cpf,
        telefone: normalizeTelefone(data.telefone),
        cep: normalizeCep(data.cep),
        endereco: data.endereco,
        complemento: data.complemento || null,
        cidade: data.cidade,
        estado: data.estado,
        user: userId,
        __createdByMasterFlow: true,
      },
    });

    try {
      await sendEmail(strapi, {
        to: email,
        subject: 'Recicla+ - Confirmação de e-mail',
        text: `Seu código de confirmação é: ${confirmationCode}\n\nEle expira em 10 minutos.`,
      });
    } catch (err) {
      strapi.log.warn(`[register-public] falha ao enviar e-mail de confirmação: ${String(err)}`);
    }

    return { created: true };
  },
});