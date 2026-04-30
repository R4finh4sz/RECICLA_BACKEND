import crypto from 'node:crypto';

type SecurityAuditLevel = 'info' | 'warn' | 'error';

interface SecurityAuditPayload {
  eventType: string;
  level?: SecurityAuditLevel;
  message: string;
  userId?: number | string | null;
  userEmailMasked?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt?: string;
}

function getAuditSecret() {
  const secret = String(process.env.AUDIT_LOG_SECRET || '').trim();
  if (!secret) {
    throw new Error('AUDIT_LOG_SECRET ausente. Configure chave para assinatura de auditoria.');
  }
  return secret;
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(sortDeep(value));
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmacSha256(value: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export async function appendSecurityAuditLog(strapi: any, payload: SecurityAuditPayload) {
  const secret = getAuditSecret();

  const last = await strapi.db.query('api::security-audit-log.security-audit-log').findOne({
    orderBy: { createdAt: 'desc' },
    select: ['hash'],
  });

  const previousHash = String((last as any)?.hash || 'GENESIS');
  const occurredAt = payload.occurredAt || new Date().toISOString();

  const signedPayload = {
    eventType: payload.eventType,
    level: payload.level || 'info',
    message: payload.message,
    userId: payload.userId ?? null,
    userEmailMasked: payload.userEmailMasked ?? null,
    ip: payload.ip ?? null,
    userAgent: payload.userAgent ?? null,
    metadata: payload.metadata ?? null,
    occurredAt,
    previousHash,
  };

  const hash = sha256(stableStringify(signedPayload));
  const signature = hmacSha256(hash, secret);

  await strapi.db.query('api::security-audit-log.security-audit-log').create({
    data: {
      ...signedPayload,
      hash,
      signature,
    },
  });

  return { hash, signature };
}
