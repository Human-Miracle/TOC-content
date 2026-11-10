// Password hashing and one-time tokens. Node built-ins only, no packages.
// Plain JavaScript so the setup script and the tests can use it too.
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';

const N = 16384, R = 8, P = 1, KEYLEN = 32;
const run = (password, salt, n, r, p, len) => new Promise((resolve, reject) =>
  scrypt(password, salt, len, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))));

/** Returns "scrypt$N$r$p$salt$hash". The password itself is never stored. */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await run(password, salt, N, R, P, KEYLEN);
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password, stored) {
  const [scheme, n, r, p, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64url');
  const got = await run(password, Buffer.from(salt, 'base64url'), +n, +r, +p, want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** A random token for cookies and one-time links. */
export const newToken = () => randomBytes(32).toString('base64url');
/** Only this hash is stored, so a database leak does not reveal usable tokens. */
export const hashToken = token => createHash('sha256').update(String(token)).digest('hex');

export const MIN_PASSWORD = 10;
export const cleanEmail = v => String(v ?? '').trim().toLowerCase();
export const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
