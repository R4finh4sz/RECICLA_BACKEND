import bcrypt from 'bcryptjs';

const DEFAULT_PASSWORD_HASH_ROUNDS = 12;
const MIN_PASSWORD_HASH_ROUNDS = 10;
const MAX_PASSWORD_HASH_ROUNDS = 15;

export function getPasswordHashRounds() {
  const raw = String(process.env.PASSWORD_HASH_ROUNDS || '').trim();
  if (!raw) return DEFAULT_PASSWORD_HASH_ROUNDS;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error('PASSWORD_HASH_ROUNDS invalido. Use um inteiro entre 10 e 15.');
  }

  if (parsed < MIN_PASSWORD_HASH_ROUNDS || parsed > MAX_PASSWORD_HASH_ROUNDS) {
    throw new Error('PASSWORD_HASH_ROUNDS fora da faixa segura (10..15).');
  }

  return parsed;
}

export async function hashPassword(plainPassword: string) {
  const rounds = getPasswordHashRounds();
  return bcrypt.hash(String(plainPassword || ''), rounds);
}
