import { ZodError } from "zod";
import {
  RegisterMunicipePublicSchema,
  type RegisterMunicipePublicInput,
} from "../validation/RegisterMunicipePublicSchema";

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


    const roleId = await getMunicipeRoleId(strapi);
    if (!roleId) return ctx.badRequest("Role Municipe não encontrada.");

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
      confirmed: true,
      blocked: false,
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
          complemento: data.complemento || null,
          imagemUrl: data.imagemUrl || null,
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


    return { created: true };
  },
});
