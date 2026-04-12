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

function normalizeOptionalText(v: unknown) {
  if (v == null) return null;
  const value = String(v).trim();
  return value.length > 0 ? value : null;
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

    try {
      data = RegisterMunicipePublicSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError)
        return ctx.badRequest("Dados inválidos no cadastro.");
      throw err;
    }

    const email = normalizeEmail(data.email);
    const cpf = normalizeCpf(data.cpf);

    const existingUser = await strapi
      .documents("plugin::users-permissions.user")
      .findFirst({
        filters: { email },
        fields: ["id"],
      });

    if (existingUser) return ctx.badRequest("E-mail já cadastrado.");

    const existingMunicipeByCpf = await strapi
      .documents("api::municipe.municipe")
      .findFirst({
        filters: { cpf },
        fields: ["id"],
      });

    if (existingMunicipeByCpf) return ctx.badRequest("CPF já cadastrado.");
    const cepClean = normalizeCep(data.cep);

    try {
      const lookup = await lookupCepViaCep(strapi, cepClean);

      if (!lookup) return ctx.badRequest("CEP inválido ou não encontrado.");
    } catch (err: any) {
      strapi.log.warn(
        `[register-public] erro na integração de CEP: ${String(err?.message || err)}`,
      );
      return ctx.badRequest(
        "Não foi possível validar o CEP no momento. Tente novamente.",
      );
    }

    const roleId = await getMunicipeRoleId(strapi);
    if (!roleId) return ctx.badRequest("Role Municipe não encontrada.");
    const confirmationCode = generateEmailConfirmationCode();
    const confirmationToken = buildEmailConfirmationToken(
      confirmationCode,
      Date.now(),
    );

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

    try {
      await strapi.documents("api::municipe.municipe").create({
        data: {
          nome: data.nome,
          cpf,
          dataNascimento: toDateOnlyString(new Date(data.dataNascimento)),
          telefone: normalizeTelefone(data.telefone),
          cep: cepClean,
          endereco: data.endereco,
          numero: data.numero,
          complemento: normalizeOptionalText(data.complemento),
          imagemUrl: normalizeOptionalText(data.imagemUrl),
          cidade: data.cidade,
          estado: data.estado,
          validadoEm: null,
          arquivadoEm: null,
          user: userId,
          __createdByMasterFlow: true,
        },
      });
    } catch (err: any) {
      const detail = String(err?.detail || err?.message || err);
      const column = err?.column ? ` Coluna: ${String(err.column)}.` : "";
      strapi.log.error(`[register-public] falha ao criar municipe: ${detail}`);
      return ctx.badRequest(
        `Falha ao criar municipe.${column} ${detail}`.trim(),
      );
    }

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
