// Este service trata o aceite de termos pelo usuário do tipo Municipe de forma simples.
import { getUserRoleName } from "./helpers/get-user-role-name";
import { appendSecurityAuditLog } from '../../../utils/security-audit-log';

function getClientIp(ctx: any) {
  const xf = String(ctx?.request?.header?.['x-forwarded-for'] || '');
  if (xf) return xf.split(',')[0].trim();
  return String(ctx?.request?.ip || ctx?.ip || 'unknown');
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized("Token inválido ou ausente.");

    const roleName = await getUserRoleName(ctx, strapi);
    if (roleName !== "Municipe") return ctx.forbidden("Apenas Municipe.");

    // Busca o termo mais recente
    const termo = await strapi.service("api::termo.get-active-termo").execute();
    if (!termo) return ctx.badRequest("Nenhum termo disponível para aceite.");

    const acceptedAt = new Date().toISOString();
    const termoDocumentId = String((termo as any).documentId ?? (termo as any).id ?? "");
    // Use explicit version if available, else fall back to title, id or createdAt
    const termoVersion = String(
      (termo as any).version ?? (termo as any).title ?? (termo as any).id ?? (termo as any).createdAt ?? new Date().toISOString(),
    );

    // Atualiza o Municipe com a data e o ID do termo aceito
    const municipe = await strapi
      .documents("api::municipe.municipe")
      .findFirst({
        filters: { user: { id: userId } },
        fields: ["documentId"],
      });

    if (!municipe) return ctx.notFound("Municipe não encontrado.");

    // Verifica se o usuário já aceitou este mesmo termo.
    // Primeiro tenta por relação `termo` (id), que é mais estável; se não existir, busca por `termDocumentId`.
    let existingAcceptance = null;
    const termoId = (termo as any).id;

    if (termoId) {
      existingAcceptance = await strapi.documents("api::term-list.term-list").findFirst({
        filters: {
          user: { id: userId as any },
          termo: { id: termoId as any },
          revoked: false,
        },
        fields: ["id"],
      });
    }

    if (!existingAcceptance) {
      existingAcceptance = await strapi
        .documents("api::term-list.term-list")
        .findFirst({
          filters: {
            user: { id: userId as any },
            termDocumentId: termoDocumentId,
            revoked: false,
          },
          fields: ["id"],
        });
    }

    if (existingAcceptance) {
      return ctx.badRequest(
        "Este termo já foi aceito por este usuário. Novo aceite somente após atualização do termo.",
      );
    }

    await strapi.documents("api::municipe.municipe").update({
      documentId: municipe.documentId,
      data: {
        acceptedTerms: true,
        acceptedAt,
        acceptedTermDocumentId: termoDocumentId,
      },
    });

    let fac = await strapi
      .documents("api::first-access-control.first-access-control")
      .findFirst({
        filters: { user: { id: userId as any } },
        fields: ["documentId", "id"],
      });

    if (!fac) {
      fac = await strapi
        .documents("api::first-access-control.first-access-control")
        .create({
          data: {
            user: userId,
            mustCompleteProfile: false,
            mustAcceptTerms: false,
            mustChangePassword: false,
            termsAcceptedAt: acceptedAt,
            termsVersionAccepted: termoVersion,
            termsAcceptedTermDocumentId: termoDocumentId,
          },
        });
    } else {
      await strapi
        .documents("api::first-access-control.first-access-control")
        .update({
          documentId: String((fac as any).documentId || (fac as any).id),
          data: {
            mustAcceptTerms: false,
            termsAcceptedAt: acceptedAt,
            termsVersionAccepted: termoVersion,
            termsAcceptedTermDocumentId: termoDocumentId,
          },
        });
    }

    // Evita aceitar a MESMA VERSÃO mais de uma vez.
    let existing = null as any;

    if (termoId) {
      existing = await strapi.documents("api::term-list.term-list").findFirst({
        filters: { user: { id: userId }, termo: { id: termoId }, version: termoVersion },
        fields: ["id"],
      });
    } else {
      existing = await strapi.documents("api::term-list.term-list").findFirst({
        filters: { user: { id: userId }, termDocumentId: termoDocumentId, version: termoVersion },
        fields: ["id"],
      });
    }

    if (existing) {
      return ctx.badRequest("Termo já aceito para esta versão.");
    }

    await strapi.documents("api::term-list.term-list").create({
      data: {
        user: userId,
        termo: termoId || undefined,
        version: termoVersion,
        termDocumentId: termoDocumentId,
        acceptedAt,
        revoked: false,
        revokedAt: null,
        revokedByUserId: null,
        revokedReason: null,
      },
    });

    try {
      await appendSecurityAuditLog(strapi, {
        eventType: 'terms.accepted',
        level: 'info',
        message: 'Aceite de termo registrado.',
        userId,
        userEmailMasked: String(ctx?.state?.user?.email || '').replace(/^(.{2}).*(@.*)$/, '$1***$2') || null,
        ip: getClientIp(ctx),
        userAgent: String(ctx?.request?.header?.['user-agent'] || ''),
        metadata: {
          version: termoVersion,
          termDocumentId: termoDocumentId,
          acceptedAt,
        },
      });
    } catch (err: any) {
      strapi.log.error(`[terms-consent] falha ao auditar aceite: ${String(err?.message || err)}`);
    }

    strapi.log.info(
      `[terms-consent] aceite registrado userId=${userId} version=${termoVersion} termDocumentId=${termoDocumentId}`,
    );

    return {
      success: true,
      message: "Termos aceitos com sucesso!",
      acceptedAt,
    };
  },
});
