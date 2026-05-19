import { ZodError } from 'zod';
import { LoginTwoFactorVerifySchema, type LoginTwoFactorVerifyInput } from '../validation/LoginTwoFactorVerifySchema';
import { appendSecurityAuditLog } from '../../../utils/security-audit-log';

function addHours(date: Date, hours: number) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

function getClientIp(ctx: any) {
  const xf = String(ctx?.request?.header?.['x-forwarded-for'] || '');
  if (xf) return xf.split(',')[0].trim();
  return String(ctx?.request?.ip || ctx?.ip || 'unknown');
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
      strapi.log.warn(`[login-2fa] tentativa para email inexistente: ${email}`);
      try {
        await appendSecurityAuditLog(strapi, {
          eventType: 'auth.2fa.failed',
          level: 'warn',
          message: 'Falha de 2FA para email inexistente.',
          userEmailMasked: `${email.slice(0, 2)}***`,
          ip: getClientIp(ctx),
          userAgent: String(ctx?.request?.header?.['user-agent'] || ''),
          metadata: { reason: 'user-not-found' },
        });
      } catch (err: any) {
        strapi.log.error(`[security-audit] falha ao registrar evento auth.2fa.failed: ${String(err?.message || err)}`);
      }
      return ctx.badRequest('Usuário não encontrado.');
    }

    const security = await strapi.documents('api::auth-security.auth-security').findFirst({
      filters: { user: { id: user.id as any } },
    });

    if (!security || !(security as any).loginTwoFactorCode || !(security as any).loginTwoFactorExpiresAt) {
      strapi.log.warn(`[login-2fa] falha por sessao expirada/ausente para userId=${user.id}`);
      try {
        await appendSecurityAuditLog(strapi, {
          eventType: 'auth.2fa.failed',
          level: 'warn',
          message: 'Falha de 2FA por sessao ausente/expirada.',
          userId: user.id,
          userEmailMasked: `${email.slice(0, 2)}***`,
          ip: getClientIp(ctx),
          userAgent: String(ctx?.request?.header?.['user-agent'] || ''),
          metadata: { reason: 'session-missing-or-expired' },
        });
      } catch (err: any) {
        strapi.log.error(`[security-audit] falha ao registrar evento auth.2fa.failed: ${String(err?.message || err)}`);
      }
      return ctx.badRequest('Sessao de autenticacao expirada. Faca login novamente.');
    }

    const currentChallenge = String((security as any).loginTwoFactorChallengeId || '');
    if (!currentChallenge || currentChallenge !== payload.challengeId) {
      strapi.log.warn(`[login-2fa] falha por challenge invalido para userId=${user.id}`);
      try {
        await appendSecurityAuditLog(strapi, {
          eventType: 'auth.2fa.failed',
          level: 'warn',
          message: 'Falha de 2FA por challenge invalido.',
          userId: user.id,
          userEmailMasked: `${email.slice(0, 2)}***`,
          ip: getClientIp(ctx),
          userAgent: String(ctx?.request?.header?.['user-agent'] || ''),
          metadata: { reason: 'challenge-mismatch' },
        });
      } catch (err: any) {
        strapi.log.error(`[security-audit] falha ao registrar evento auth.2fa.failed: ${String(err?.message || err)}`);
      }
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
      strapi.log.warn(`[login-2fa] falha por codigo expirado para userId=${user.id}`);
      try {
        await appendSecurityAuditLog(strapi, {
          eventType: 'auth.2fa.failed',
          level: 'warn',
          message: 'Falha de 2FA por codigo expirado.',
          userId: user.id,
          userEmailMasked: `${email.slice(0, 2)}***`,
          ip: getClientIp(ctx),
          userAgent: String(ctx?.request?.header?.['user-agent'] || ''),
          metadata: { reason: 'code-expired' },
        });
      } catch (err: any) {
        strapi.log.error(`[security-audit] falha ao registrar evento auth.2fa.failed: ${String(err?.message || err)}`);
      }
      return ctx.badRequest('Codigo invalido ou expirado.');
    }

    const storedCode = String((security as any).loginTwoFactorCode || '');
    if (storedCode !== payload.code) {
      strapi.log.warn(`[login-2fa] falha por codigo incorreto para userId=${user.id}`);
      try {
        await appendSecurityAuditLog(strapi, {
          eventType: 'auth.2fa.failed',
          level: 'warn',
          message: 'Falha de 2FA por codigo incorreto.',
          userId: user.id,
          userEmailMasked: `${email.slice(0, 2)}***`,
          ip: getClientIp(ctx),
          userAgent: String(ctx?.request?.header?.['user-agent'] || ''),
          metadata: { reason: 'code-mismatch' },
        });
      } catch (err: any) {
        strapi.log.error(`[security-audit] falha ao registrar evento auth.2fa.failed: ${String(err?.message || err)}`);
      }
      return ctx.badRequest('Codigo invalido ou expirado.');
    }
    const now = new Date();

    const rememberMe = Boolean((security as any).loginTwoFactorRememberMe);
    const hours = rememberMe ? 720 : 24;
    const expiresIn = rememberMe ? '30d' : '1d';
    const tokenExpiresAt = addHours(now, hours);

    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const token = jwtService.issue({ id: user.id }, { expiresIn });

    await strapi.documents('api::auth-security.auth-security').update({
      documentId: String((security as any).documentId || (security as any).id),
      data: {
        lastLoginAt: now,
        lastLoginIp: getClientIp(ctx),
        lastLoginUserAgent: String(ctx?.request?.header?.['user-agent'] || ''),
        loginTwoFactorChallengeId: null,
        loginTwoFactorCode: null,
        loginTwoFactorExpiresAt: null,
        loginTwoFactorRememberMe: false,
      },
    });

    strapi.log.info(`[login-2fa] sucesso para userId=${user.id}`);
    try {
      await appendSecurityAuditLog(strapi, {
        eventType: 'auth.login.success',
        level: 'info',
        message: 'Autenticacao concluida com sucesso apos 2FA.',
        userId: user.id,
        userEmailMasked: `${email.slice(0, 2)}***`,
        ip: getClientIp(ctx),
        userAgent: String(ctx?.request?.header?.['user-agent'] || ''),
        metadata: { rememberMe },
      });
    } catch (err: any) {
      strapi.log.error(`[security-audit] falha ao registrar evento auth.login.success: ${String(err?.message || err)}`);
    }

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
      twoFactorSkippedUntil: null,
      rememberMe,
      expiresAt: tokenExpiresAt.toISOString(),
    };
  },
});
