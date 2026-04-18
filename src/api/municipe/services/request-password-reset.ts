import { ZodError } from 'zod';
import crypto from 'node:crypto';
import {
  RequestPasswordResetSchema,
  type RequestPasswordResetInput,
} from '../validation/RequestPasswordResetSchema';

function addMinutes(date: Date, minutes: number) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function generateResetCode() {
  return String(crypto.randomInt(100000, 1000000));
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

    const user = await strapi.documents('plugin::users-permissions.user').findFirst({
      filters: { email },
      fields: ['id', 'email'],
      populate: { role: { fields: ['name'] } },
    });

    if (!user || ((user as any).role?.name !== 'Municipe' && (user as any).role !== 'Municipe')) {
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

    if (cnt >= 3) return { sent: true };

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

    return { sent: true };
  },
});