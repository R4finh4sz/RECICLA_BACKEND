import crypto from 'node:crypto';

const ENCRYPTION_PREFIX = 'enc::v1::';

let cachedKey: Buffer | null = null;

function getRawKey() {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('DATA_ENCRYPTION_KEY ausente. Configure uma chave base64 de 32 bytes.');
  }

  return raw.trim();
}

function getEncryptionKey() {
  if (cachedKey) return cachedKey;

  const raw = getRawKey();
  const key = Buffer.from(raw, 'base64');

  if (key.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY inválida. Esperado: base64 de 32 bytes (AES-256).');
  }

  cachedKey = key;
  return key;
}

function getHashSecret() {
  return process.env.DATA_HASH_PEPPER || getRawKey();
}

export function buildSensitiveLookupHash(value: string) {
  return crypto
    .createHmac('sha256', getHashSecret())
    .update(value)
    .digest('hex');
}

export function encryptIfNeeded(value: unknown) {
  if (value == null) return value;

  const plain = String(value);
  if (!plain) return plain;
  if (plain.startsWith(ENCRYPTION_PREFIX)) return plain;

  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptIfNeeded(value: unknown) {
  if (value == null || typeof value !== 'string') return value;
  if (!value.startsWith(ENCRYPTION_PREFIX)) return value;

  const payload = value.slice(ENCRYPTION_PREFIX.length);
  const [ivB64, tagB64, encryptedB64] = payload.split('.');

  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Payload criptografado inválido.');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
