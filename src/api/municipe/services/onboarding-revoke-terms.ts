import { getUserRoleName } from "./helpers/get-user-role-name";
import { appendSecurityAuditLog } from '../../../utils/security-audit-log';
import { TokenRevocationService } from './token-revocation.service';

function getClientIp(ctx: any) {
  const xf = String(ctx?.request?.header?.['x-forwarded-for'] || '');
  if (xf) return xf.split(',')[0].trim();
  return String(ctx?.request?.ip || ctx?.ip || 'unknown');
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const userId = ctx?.state?.user?.id;
    if (!userId) return ctx.unauthorized("Token invalido ou ausente.");

    const authHeader = ctx?.request?.header?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Token invalido ou ausente.');
    }

    const token = authHeader.split(' ')[1];
    const revocationService = new TokenRevocationService(strapi);

    const roleName = await getUserRoleName(ctx, strapi);
    if (roleName !== "Municipe") return ctx.forbidden("Apenas Municipe.");

    const municipe = await strapi
      .documents("api::municipe.municipe")
      .findFirst({
        filters: { user: { id: userId } },
        fields: ["documentId", "id", "acceptedTermDocumentId"],
      });

    if (!municipe) return ctx.notFound("Municipe nao encontrado.");

    const fac = await strapi
      .documents("api::first-access-control.first-access-control")
      .findFirst({
        filters: { user: { id: userId } },
        fields: ["documentId", "id", "termsAcceptedTermDocumentId", "mustAcceptTerms"],
      });

    const termDocumentIdToRevoke =
      ((fac as any)?.termsAcceptedTermDocumentId as any) ||
      ((municipe as any).acceptedTermDocumentId as any);

    if (!termDocumentIdToRevoke || (fac as any)?.mustAcceptTerms) {
      return ctx.badRequest("Consentimento já revogado para este termo.");
    }

    const activeAcceptance = await strapi
      .documents("api::term-list.term-list")
      .findFirst({
        filters: {
          user: { id: userId as any },
          termDocumentId: termDocumentIdToRevoke,
          revoked: false,
        },
        fields: ["documentId", "id"],
      });

    if (!activeAcceptance) {
      return ctx.badRequest("Consentimento já revogado para este termo.");
    }

    await strapi.documents("api::municipe.municipe").update({
      documentId: String((municipe as any).documentId || (municipe as any).id),
      data: {
        acceptedTerms: false,
        acceptedAt: null,
        acceptedTermDocumentId: null,
      },
    });

    if (fac) {
      await strapi
        .documents("api::first-access-control.first-access-control")
        .update({
          documentId: String((fac as any).documentId || (fac as any).id),
          data: {
            mustAcceptTerms: true,
            termsAcceptedAt: null,
            termsVersionAccepted: null,
            termsAcceptedTermDocumentId: null,
          },
        });
    }

    // Marca o(s) registro(s) em term-list como revogados para impedir acesso
    // e permitir aceitação somente após atualização do termo.
    const existing = await strapi
      .documents("api::term-list.term-list")
      .findMany({
        filters: { user: { id: userId as any }, termDocumentId: termDocumentIdToRevoke },
        fields: ["documentId", "id"],
      });

    for (const rec of existing || []) {
      await strapi.documents("api::term-list.term-list").update({
        documentId: String((rec as any).documentId || (rec as any).id),
        data: {
          revoked: true,
          revokedAt: new Date().toISOString(),
          revokedByUserId: String(userId),
          revokedReason: 'Revogacao solicitada pelo proprio municipe.',
        },
      });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 2);
    await revocationService.revoke(token, expiresAt);

    try {
      await appendSecurityAuditLog(strapi, {
        eventType: 'terms.revoked',
        level: 'warn',
        message: 'Revogacao de termo registrada.',
        userId,
        userEmailMasked: String(ctx?.state?.user?.email || '').replace(/^(.{2}).*(@.*)$/, '$1***$2') || null,
        ip: getClientIp(ctx),
        userAgent: String(ctx?.request?.header?.['user-agent'] || ''),
        metadata: {
          termDocumentId: termDocumentIdToRevoke,
          revokedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      strapi.log.error(`[terms-consent] falha ao auditar revogacao: ${String(err?.message || err)}`);
    }

    strapi.log.warn(`[terms-consent] revogacao registrada userId=${userId}`);

    return {
      success: true,
      revokedAt: new Date().toISOString(),
      mustAcceptTerms: true,
    };
  },
});
