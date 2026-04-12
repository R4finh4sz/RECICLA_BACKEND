// Este controller trata o aceite de termos pelo usuário do tipo Municipe.
// Entrada esperada: { version: string, documentId: string } no body.
// - Verifica token e role do usuário.
// - Valida o body com Zod.
// - Busca o termo ativo e compara versão + documentId.
// - Verifica se já existe aceite igual; se não existir, limpa históricos antigos e cria um novo.
// - Atualiza o registro de first-access-control com os dados do aceite.
import { ZodError } from "zod";
import { AcceptTermsSchema } from "../validation/AcceptTermsSchema";
import { getUserRoleName } from "./helpers/get-user-role-name";
import { getFirstAccessControl } from "./helpers/get-first-access-control";

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    // Obtém o id do usuário que o middleware de autenticação colocou em ctx.state.user
    const userId = ctx?.state?.user?.id;
    const userDocumentId = ctx?.state?.user?.documentId;

    // Se não houver userId, rejeita por token inválido/ausente
    if (!userId) return ctx.unauthorized("Token inválido ou ausente.");

    // Obtém o nome do role do usuário; apenas Municipe tem permissão aqui
    const roleName = getUserRoleName(ctx);
    if (roleName !== "Municipe") return ctx.forbidden("Apenas Municipe.");

    // Validação do body: espera version e documentId
    let payload: { version: string; documentId: string };
    try {
      payload = AcceptTermsSchema.parse(ctx.request.body || {});
    } catch (err) {
      // Se a validação falhar, retorna 400 com instrução simples do formato esperado
      if (err instanceof ZodError) {
        return ctx.badRequest("Body inválido. Envie { version, documentId }.");
      }
      // Se for outro erro inesperado, relança para tratamento genérico
      throw err;
    }

    // Recupera o termo ativo pelo serviço
    const termo = await strapi.service("api::termo.get-active-termo").execute();

    // Se não houver termo ativo, não há o que aceitar
    if (!termo)
      return ctx.badRequest("Nenhum termo ativo disponível para aceite.");

    // Compara a versão e o documentId enviados com o termo ativo para evitar aceite desatualizado
    if (
      payload.version !== (termo as any).version ||
      payload.documentId !==
        String((termo as any).documentId || (termo as any).id)
    ) {
      return ctx.badRequest("Termo desatualizado. Atualize e tente novamente.");
    }

    // 1) Verifica se já existe um registro de aceite para este usuário + versão + documentId
    const existingAcceptance = await strapi
      .documents("api::term-list.term-list")
      .findFirst({
        filters: {
          user: { id: userId },
          version: payload.version,
          termDocumentId: payload.documentId,
        },
      });

    // 2) Se não existir esse aceite, limpa aceites antigos para manter só o atual
    if (!existingAcceptance) {
      // Deleta todas as entradas de termos desse usuário para evitar duplicidade
      // (nota: se for necessário manter histórico no futuro, esta é a linha a revisar)
      await strapi.db.query("api::term-list.term-list").deleteMany({
        where: {
          user: { id: userId },
        },
      });
    }

    // Garante que exista um documento de first-access-control para este usuário
    let fac = await getFirstAccessControl(strapi, userId);

    // Se não existir, cria com os valores iniciais necessários
    if (!fac) {
      fac = await strapi
        .documents("api::first-access-control.first-access-control")
        .create({
          data: {
            user: userDocumentId,
            mustCompleteProfile: false,
            mustAcceptTerms: true,
            mustChangePassword: false,
            tempPasswordExpiresAt: new Date().toISOString(),
          },
        });
    }

    // Timestamp do aceite usado nos registros
    const acceptedAt = new Date().toISOString();

    // Atualiza o first-access-control marcando que o usuário aceitou o termo
    await strapi
      .documents("api::first-access-control.first-access-control")
      .update({
        documentId: String((fac as any).documentId),
        data: {
          mustAcceptTerms: false,
          termsAcceptedAt: acceptedAt,
          termsVersionAccepted: payload.version,
          termsAcceptedTermDocumentId: payload.documentId,
          mustChangePassword: false,
          tempPasswordExpiresAt: null,
          tempPasswordIssuedAt: null,
          tempPasswordUsedAt: null,
        },
      });

    // Atualiza o Municipe para expor o boolean
    try {
      const municipe = await strapi
        .documents("api::municipe.municipe")
        .findFirst({
          filters: { user: { id: userId } },
          fields: ["documentId"],
        });

      if (municipe) {
        await strapi.documents("api::municipe.municipe").update({
          documentId: String(
            (municipe as any).documentId || (municipe as any).id,
          ),
          data: {
            acceptedTerms: true,
            acceptedAt,
            acceptedTermDocumentId: String(
              (termo as any).documentId || (termo as any).id,
            ),
          },
        });
      }
    } catch (e) {
      // não interrompe o fluxo principal; log para depuração
      strapi.log.error("Erro ao atualizar municipe.acceptedTerms:", e);
    }

    // 3) Cria o registro no term-list apenas se realmente for novo (evita duplicidade)
    if (!existingAcceptance) {
      const uid = "api::term-list.term-list" as any;

      await strapi.documents(uid).create({
        data: {
          user: userDocumentId,
          termo: (termo as any).documentId,
          version: payload.version,
          termDocumentId: payload.documentId,
          acceptedAt,
        },
      });

      // Retorna mensagem informando que foi registrado novo aceite e histórico limpo
      return {
        accepted: true,
        message: "Novo aceite registrado e histórico antigo limpo.",
      };
    }

    // Se já existia o registro de aceite (mesma versão + documentId), não altera o banco
    return { accepted: true, message: "Termo já aceito anteriormente." };
  },
});
