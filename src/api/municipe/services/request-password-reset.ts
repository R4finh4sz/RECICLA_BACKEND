import { ZodError } from 'zod';
import crypto from 'node:crypto';
import {
  RequestPasswordResetSchema,
  type RequestPasswordResetInput,
} from '../validation/RequestPasswordResetSchema';
import { appendSecurityAuditLog } from '../../../utils/security-audit-log';

function addMinutes(date: Date, minutes: number) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function generateResetCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function maskEmail(email: string) {
  const [local = '', domain = ''] = String(email || '').split('@');
  if (!domain) return '***';
  const visibleLocal = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visibleLocal}***@${domain}`;
}

function getClientIp(ctx: any) {
  const xf = String(ctx?.request?.header?.['x-forwarded-for'] || '');
  if (xf) return xf.split(',')[0].trim();
  return String(ctx?.request?.ip || ctx?.ip || 'unknown');
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let data: RequestPasswordResetInput;
    try {
      data = RequestPasswordResetSchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) return ctx.badRequest('Solicitação inválida.');
      throw err;
    }

    const email = data.email.trim().toLowerCase();
    const maskedEmail = maskEmail(email);
    const ip = getClientIp(ctx);
    const userAgent = String(ctx?.request?.header?.['user-agent'] || '');

    strapi.log.info(`[password-reset] solicitacao recebida para ${maskedEmail}`);
    try {
      await appendSecurityAuditLog(strapi, {
        eventType: 'password-reset.request.received',
        level: 'info',
        message: 'Solicitacao de recuperacao de senha recebida.',
        userEmailMasked: maskedEmail,
        ip,
        userAgent,
      });
    } catch (err: any) {
      strapi.log.error(`[security-audit] falha ao registrar evento password-reset.request.received: ${String(err?.message || err)}`);
    }

    const user = await strapi.documents('plugin::users-permissions.user').findFirst({
      filters: { email },
      fields: ['id', 'email'],
      populate: { role: { fields: ['name'] } },
    });

    if (!user || ((user as any).role?.name !== 'Municipe' && (user as any).role !== 'Municipe')) {
      strapi.log.info(`[password-reset] solicitacao finalizada sem usuario elegivel: ${maskedEmail}`);
      try {
        await appendSecurityAuditLog(strapi, {
          eventType: 'password-reset.request.ignored',
          level: 'warn',
          message: 'Solicitacao finalizada sem usuario elegivel.',
          userEmailMasked: maskedEmail,
          ip,
          userAgent,
        });
      } catch (err: any) {
        strapi.log.error(`[security-audit] falha ao registrar evento password-reset.request.ignored: ${String(err?.message || err)}`);
      }
      return { sent: true };
    }

    const userId = (user as any).id;

    const security =
      (await strapi.documents('api::auth-security.auth-security').findFirst({
        filters: { user: { id: userId } },
      })) ||
      (await strapi.documents('api::auth-security.auth-security').create({
        data: { user: userId },
      }));

    const now = new Date();

    const windowStartValue = (security as any).passwordResetRequestsWindowStart;
    const windowStart = windowStartValue ? new Date(windowStartValue) : null;

    let cnt = Number((security as any).passwordResetRequestsCount || 0);

    if (!windowStart || now.getTime() - windowStart.getTime() > 60 * 60 * 1000) {
      cnt = 0;
    }

    if (cnt >= 3) {
      strapi.log.warn(`[password-reset] limite de solicitacoes atingido para ${maskedEmail}`);
      try {
        await appendSecurityAuditLog(strapi, {
          eventType: 'password-reset.request.rate-limited',
          level: 'warn',
          message: 'Limite de solicitacoes de recuperacao atingido.',
          userId,
          userEmailMasked: maskedEmail,
          ip,
          userAgent,
          metadata: { requestsInWindow: cnt },
        });
      } catch (err: any) {
        strapi.log.error(`[security-audit] falha ao registrar evento password-reset.request.rate-limited: ${String(err?.message || err)}`);
      }
      return { sent: true };
    }

    const existingFac = await strapi.documents('api::first-access-control.first-access-control').findFirst({
      filters: { user: { id: userId } },
    });

    const fac =
      existingFac ||
      (await strapi.documents('api::first-access-control.first-access-control').create({
        data: {
          user: userId,
          mustCompleteProfile: false,
          mustAcceptTerms: true,
          mustChangePassword: false,
          tempPasswordExpiresAt: now.toISOString(),
        },
      }));

    const code = generateResetCode();
    const expiresAt = addMinutes(now, 10);

    await strapi.documents('api::first-access-control.first-access-control').update({
      documentId: String((fac as any).documentId || (fac as any).id),
      data: {
        passwordResetCode: code,
        passwordResetExpiresAt: expiresAt.toISOString(),
        passwordResetRequestedAt: now.toISOString(),
        passwordResetUsedAt: null,
      },
    });

    await strapi.documents('api::auth-security.auth-security').update({
      documentId: String((security as any).documentId || (security as any).id),
      data: {
        passwordResetRequestsCount: cnt + 1,
        passwordResetRequestsWindowStart: windowStart ? windowStart.toISOString() : now.toISOString(),
      },
    });

    strapi.log.info(
      `[password-reset] codigo gerado para ${maskedEmail}; expira em ${expiresAt.toISOString()}`,
    );
    try {
      await appendSecurityAuditLog(strapi, {
        eventType: 'password-reset.code.generated',
        level: 'info',
        message: 'Codigo de recuperacao de senha gerado.',
        userId,
        userEmailMasked: maskedEmail,
        ip,
        userAgent,
        metadata: { expiresAt: expiresAt.toISOString() },
      });
    } catch (err: any) {
      strapi.log.error(`[security-audit] falha ao registrar evento password-reset.code.generated: ${String(err?.message || err)}`);
    }

    return { sent: true };
  },
});