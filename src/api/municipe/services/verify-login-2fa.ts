import { ZodError } from 'zod';
import { LoginTwoFactorVerifySchema, type LoginTwoFactorVerifyInput } from '../validation/LoginTwoFactorVerifySchema';

function addHours(date: Date, hours: number) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

function endOfToday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function getClientIp(ctx: any) {
  return (
    ctx.request?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
    ctx.request?.ip ||
    ctx.req?.socket?.remoteAddress ||
    'unknown'
  );
}

function getUserAgent(ctx: any) {
  return String(ctx.request?.headers?.['user-agent'] || 'unknown');
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    let payload: LoginTwoFactorVerifyInput;
    try {
      payload = LoginTwoFactorVerifySchema.parse(ctx.request.body || {});
    } catch (err) {
      if (err instanceof ZodError) {
        return ctx.badRequest('Dados invalidos para verificacao do codigo.', { details: err.issues });
      }
      throw err;
    }

    const email = payload.email.trim().toLowerCase();

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { email },
      populate: ['role'],
    });

    if (!user) {
      return ctx.badRequest('Usuário não encontrado.');
    }

    const security = await strapi.documents('api::auth-security.auth-security').findFirst({
      filters: { user: { id: user.id as any } },
    });

    if (!security || !(security as any).loginTwoFactorCode || !(security as any).loginTwoFactorExpiresAt) {
      return ctx.badRequest('Sessao de autenticacao expirada. Faca login novamente.');
    }

    const currentChallenge = String((security as any).loginTwoFactorChallengeId || '');
    if (!currentChallenge || currentChallenge !== payload.challengeId) {
      return ctx.badRequest('Sessao de autenticacao expirada. Faca login novamente.');
    }

    const expiresAtMs = new Date((security as any).loginTwoFactorExpiresAt).getTime();
    if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
      await strapi.documents('api::auth-security.auth-security').update({
        documentId: String((security as any).documentId || (security as any).id),
        data: {
          loginTwoFactorChallengeId: null,
          loginTwoFactorCode: null,
          loginTwoFactorExpiresAt: null,
          loginTwoFactorRememberMe: false,
        },
      });
      return ctx.badRequest('Codigo invalido ou expirado.');
    }

    const storedCode = String((security as any).loginTwoFactorCode || '');
    if (storedCode !== payload.code) {
      return ctx.badRequest('Codigo invalido ou expirado.');
    }
    const now = new Date();

    const rememberMe = Boolean((security as any).loginTwoFactorRememberMe);
    const hours = rememberMe ? 720 : 24;
    const expiresIn = rememberMe ? '30d' : '1d';
    const tokenExpiresAt = addHours(now, hours);
    const rememberDeviceToday = Boolean(payload.rememberDeviceToday);
    const ip = getClientIp(ctx);
    const userAgent = getUserAgent(ctx);

    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const token = jwtService.issue({ id: user.id }, { expiresIn });

    if (rememberDeviceToday) {
      const skipUntil = endOfToday(now);
      const existingDevice = await strapi.documents('api::trusted-device.trusted-device').findFirst({
        filters: {
          user: { id: user.id as any },
          ip,
          userAgent,
        },
      });

      if (existingDevice) {
        await strapi.documents('api::trusted-device.trusted-device').update({
          documentId: String((existingDevice as any).documentId || (existingDevice as any).id),
          data: {
            lastSeenAt: now,
            timesSeen: Number((existingDevice as any).timesSeen || 1) + 1,
            twoFactorSkipUntil: skipUntil.toISOString(),
          },
        });
      } else {
        await strapi.documents('api::trusted-device.trusted-device').create({
          data: {
            user: user.id,
            ip,
            userAgent,
            firstSeenAt: now,
            lastSeenAt: now,
            timesSeen: 1,
            twoFactorSkipUntil: skipUntil.toISOString(),
          },
        });
      }
    }

    await strapi.documents('api::auth-security.auth-security').update({
      documentId: String((security as any).documentId || (security as any).id),
      data: {
        lastLoginAt: now,
        loginTwoFactorChallengeId: null,
        loginTwoFactorCode: null,
        loginTwoFactorExpiresAt: null,
        loginTwoFactorRememberMe: false,
      },
    });

    return {
      jwt: token,
      user: {
        id: user.id,
        documentId: (user as any).documentId,
        username: user.username,
        email: user.email,
        role: user.role ? {
          id: user.role.id,
          name: user.role.name,
          type: user.role.type,
        } : null,
      },
      twoFactorSkippedUntil: rememberDeviceToday ? endOfToday(now).toISOString() : null,
      rememberMe,
      expiresAt: tokenExpiresAt.toISOString(),
    };
  },
});
