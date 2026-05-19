import crypto from 'node:crypto';

const EMAIL_CONFIRMATION_TTL_MS = 10 * 60 * 1000;

export function generateEmailConfirmationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export function buildEmailConfirmationToken(code: string, now = Date.now()) {
  return `confirm_code:${code}:${now + EMAIL_CONFIRMATION_TTL_MS}`;
}

export function parseEmailConfirmationToken(token: unknown) {
  const value = String(token || '');
  const match = value.match(/^confirm_code:(\d{6}):(\d+)$/);
  if (!match) return null;

  return {
    code: match[1],
    expiresAt: Number(match[2]),
  };
}
