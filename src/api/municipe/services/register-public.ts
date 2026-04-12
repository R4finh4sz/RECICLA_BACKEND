// Cadastro público do municipe.
// Aqui eu aplico as RN de:
// - validação de e-mail/senha (via Zod)
// - CPF único (e válido)
// - maior de 18 anos
// - status inicial AGUARDANDO_VALIDACAO
// - envio de código de confirmação por e-mail (10 min)
// - validação do CEP via integração (RN 3.4.5)

import { ZodError } from "zod";
import {
  RegisterMunicipePublicSchema,
  type RegisterMunicipePublicInput,
} from "../validation/RegisterMunicipePublicSchema";
import { sendEmail } from "./helpers/send-email";
import {
  buildEmailConfirmationToken,
  generateEmailConfirmationCode,
} from "./helpers/email-confirmation-code";
import { lookupCepViaCep } from "./helpers/cep";

function normalizeEmail(v: string) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function normalizeCpf(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeCep(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeTelefone(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function toDateOnlyString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getMunicipeRoleId(strapi: any) {
  const role = await strapi
    .documents("plugin::users-permissions.role")
    .findFirst({
      filters: { name: "Municipe" },
      fields: ["id", "name"],
    });

  return role ? (role as any).id : null;
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let data: RegisterMunicipePublicInput;

    // 1) Validação do payload (RN de formato de e-mail/senha, CPF, etc.)
    try {
      data = RegisterMunicipePublicSchema.parse(ctx.request.body || {});
    } catch (err) {
      // Eu retorno uma mensagem genérica porque não quero dar pista de validações internas.
      if (err instanceof ZodError)
        return ctx.badRequest("Dados inválidos no cadastro.");
      throw err;
    }

    const email = normalizeEmail(data.email);
    const cpf = normalizeCpf(data.cpf);

    // 2) e-mail (RN 3.4.11).
    const existingUser = await strapi
      .documents("plugin::users-permissions.user")
      .findFirst({
        filters: { email },
        fields: ["id"],
      });

    // Resposta neutra por segurança (mesma ideia do login).
    if (existingUser) return ctx.badRequest("E-mail já cadastrado.");

    // 3) CPF (RN 3.4.2).
    const existingMunicipeByCpf = await strapi
      .documents("api::municipe.municipe")
      .findFirst({
        filters: { cpf },
        fields: ["id"],
      });

    if (existingMunicipeByCpf) return ctx.badRequest("CPF já cadastrado.");

    // 4) CEP (RN 3.4.5) - valida se existe de verdade consultando ViaCEP.
    // Eu faço isso no back-end para garantir que o CEP não é só formato válido, mas que ele foi encontrado.
    const cepClean = normalizeCep(data.cep);

    try {
      const lookup = await lookupCepViaCep(strapi, cepClean);

      // Se não encontrou, eu bloqueio o cadastro.
      if (!lookup) return ctx.badRequest("CEP inválido ou não encontrado.");
    } catch (err: any) {
      // Se a API externa estiver fora, eu não consigo validar o CEP; então eu travo o cadastro de forma controlada.
      strapi.log.warn(
        `[register-public] erro na integração de CEP: ${String(err?.message || err)}`,
      );
      return ctx.badRequest(
        "Não foi possível validar o CEP no momento. Tente novamente.",
      );
    }

    const roleId = await getMunicipeRoleId(strapi);
    if (!roleId) return ctx.badRequest("Role Municipe não encontrada.");

    // 5) Gera código de confirmação (RN: código com validade de 10 min).
    const confirmationCode = generateEmailConfirmationCode();
    const confirmationToken = buildEmailConfirmationToken(
      confirmationCode,
      Date.now(),
    );

    // 6) Cria usuário no plugin de autenticação.
    const userService = strapi
      .plugin("users-permissions")
      .service("user") as any;
    const createUser =
      userService.create?.bind(userService) ||
      userService.add?.bind(userService);
    if (!createUser)
      return ctx.badRequest("Serviço de criação de usuário indisponível.");

    const createdUser = await createUser({
      email,
      username: (data.username || email.split("@")[0]).trim(),
      password: data.password,
      role: roleId,
      confirmed: false,
      blocked: false,
      confirmationToken,
    });

    const userId = (createdUser as any).id;

    // 7) Cria a entidade municipe com status inicial aguardando validação.
    await strapi.documents("api::municipe.municipe").create({
      data: {
        nome: data.nome,
        cpf,
        dataNascimento: toDateOnlyString(new Date(data.dataNascimento)),
        telefone: normalizeTelefone(data.telefone),
        cep: cepClean,
        endereco: data.endereco,
        numero: data.numero,
        complemento: data.complemento || null,
        imagemUrl: data.imagemUrl || null,
        cidade: data.cidade,
        estado: data.estado,
        statusCadastro: "AGUARDANDO_VALIDACAO",
        validadoEm: null,
        arquivadoEm: null,
        user: userId,

        // Eu uso esse flag só para controle interno. O lifecycle remove ele antes de salvar.
        __createdByMasterFlow: true,
      },
    });

    // 8) Envia e-mail com o código (se falhar, log e não quebra o cadastro).
    try {
      await sendEmail(strapi, {
        to: email,
        subject: "Recicla Online - Confirmação de e-mail",
        text: `Seu código de confirmação é: ${confirmationCode}\n\nEle expira em 10 minutos.`,
      });
    } catch (err) {
      strapi.log.warn(
        `[register-public] falha ao enviar e-mail de confirmação: ${String(err)}`,
      );
    }

    return { created: true };
  },
});
