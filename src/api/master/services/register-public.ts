import { ZodError } from "zod";
import {
  RegisterMasterPublicSchema,
  type RegisterMasterPublicInput,
} from "../validation/RegisterMasterPublicSchema";
import { buildSensitiveLookupHash } from "../../../utils/data-protection";
import { hashPassword } from "../../../utils/password-hash";

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

async function getMasterRoleId(strapi: any) {
  let role = await strapi
    .documents("plugin::users-permissions.role")
    .findFirst({
      filters: { name: "Master" },
      fields: ["id", "name"],
    });

  if (!role) {
    role = await strapi.documents("plugin::users-permissions.role").create({
      data: {
        name: "Master",
        description: "Role for Master users",
      },
    });
  }

  return role ? (role as any).id : null;
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let data: RegisterMasterPublicInput;

    try {
      data = RegisterMasterPublicSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError)
        return ctx.badRequest("Dados inválidos no cadastro.");
      throw err;
    }

    const email = normalizeEmail(data.email);
    const cpf = normalizeCpf(data.cpf);
    const cpfHash = buildSensitiveLookupHash(cpf);

    const existingUser = await strapi
      .documents("plugin::users-permissions.user")
      .findFirst({
        filters: { email },
        fields: ["id"],
      });

    if (existingUser) return ctx.badRequest("E-mail já cadastrado.");

    const existingMasterByCpf = await strapi
      .documents("api::master.master")
      .findFirst({
        filters: {
          $or: [{ cpfHash }, { cpf }],
        },
        fields: ["id", "cpfHash", "cpf"],
      });

    if (existingMasterByCpf) return ctx.badRequest("CPF já cadastrado.");

    const cepClean = normalizeCep(data.cep);

    const roleId = await getMasterRoleId(strapi);
    if (!roleId) return ctx.badRequest("Role Master não encontrada.");

    const passwordHash = await hashPassword(data.password);

    const createdUser = await strapi.db.query("plugin::users-permissions.user").create({
      data: {
      email,
      username: (data.username || email.split("@")[0]).trim(),
      provider: "local",
      password: passwordHash,
      role: roleId,
      confirmed: true,
      blocked: false,
      },
    });

    const userId = (createdUser as any).id;

    try {
      await strapi.documents("api::master.master").create({
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
          _newUserId: userId,
        },
      });
    } catch (err: any) {
      const detail = String(err?.detail || err?.message || err);
      const column = err?.column ? ` Coluna: ${String(err.column)}.` : "";
      strapi.log.error(`[register-public] falha ao criar master: ${detail}`);
      return ctx.badRequest(
        `Falha ao criar master.${column} ${detail}`.trim(),
      );
    }

    const existingWallet = await strapi
      .documents("api::eco-coin.eco-coin")
      .findFirst({
        filters: { user: userId },
        fields: ["id"],
      });

    if (!existingWallet) {
      await strapi.documents("api::eco-coin.eco-coin").create({
        data: {
          balance: 0,
          user: userId,
        },
      });
    }

    return { created: true };
  },
});