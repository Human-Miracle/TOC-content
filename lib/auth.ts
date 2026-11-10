import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasDb, q } from './db';
import { hashPassword, hashToken, newToken, verifyPassword } from './password.mjs';

export type User = { id: string; email: string; name: string; role: 'owner' | 'editor' };

const COOKIE = 'toc_admin';
const SESSION_DAYS = 30;
const MAX_FAILS = 8;          // failed sign-ins allowed per email...
const FAIL_WINDOW_MIN = 15;   // ...in this many minutes

/** The signed-in user, or null. */
export async function getUser(): Promise<User | null> {
  if (!hasDb()) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await q<User>(
    `select u.id, u.email, u.name, u.role from auth_sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`, [hashToken(token)]);
  return rows[0] ?? null;
}

/** Every admin page and every admin action starts with this. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect('/admin/login');
  return user;
}

export async function requireOwner(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'owner') redirect('/admin?err=' + encodeURIComponent('Only an owner can do that.'));
  return user;
}

async function startSession(userId: string) {
  const token = newToken();
  await q(`insert into auth_sessions (token_hash, user_id, expires_at) values ($1, $2, now() + $3 * interval '1 day')`,
    [hashToken(token), userId, SESSION_DAYS]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86400,
  });
}

// Checked even when the email is unknown, so timing does not reveal which emails exist.
let dummyHash: Promise<string> | null = null;

/** Returns an error message, or null when signed in. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const [{ n }] = await q<{ n: number }>(
    `select count(*)::int as n from auth_attempts where email = $1 and at > now() - $2 * interval '1 minute'`, [email, FAIL_WINDOW_MIN]);
  if (n >= MAX_FAILS) return `Too many tries. Wait ${FAIL_WINDOW_MIN} minutes and try again.`;

  const [user] = await q<{ id: string; password_hash: string }>('select id, password_hash from users where email = $1', [email]);
  const ok = await verifyPassword(password, user ? user.password_hash : await (dummyHash ??= hashPassword(newToken())));
  if (!user || !ok) {
    await q('insert into auth_attempts (email) values ($1)', [email]);
    return 'Wrong email or password.';
  }
  await q('delete from auth_attempts where email = $1 or at < now() - interval \'1 day\'', [email]);
  await q('delete from auth_sessions where expires_at < now()');
  await startSession(user.id);
  return null;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q('delete from auth_sessions where token_hash = $1', [hashToken(token)]);
  jar.delete(COOKIE);
}

export type Invite = { email: string | null; role: 'owner' | 'editor' };

/** A one-time link that is still usable, or null. */
export async function findInvite(token: string): Promise<Invite | null> {
  if (!hasDb() || !token) return null;
  const rows = await q<Invite>(
    'select email, role from invites where token_hash = $1 and used_at is null and expires_at > now()', [hashToken(token)]);
  return rows[0] ?? null;
}

/** Use a one-time link to create an account and sign in. Returns an error message or null. */
export async function acceptInvite(token: string, name: string, email: string, password: string): Promise<string | null> {
  // Claim the link first so it cannot be used twice, even by two requests at once.
  const [inv] = await q<Invite>(
    `update invites set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning email, role`,
    [hashToken(token)]);
  if (!inv) return 'This link has been used or has expired. Ask an owner for a new one.';
  const finalEmail = inv.email ?? email;
  try {
    const [u] = await q<{ id: string }>(
      'insert into users (email, name, password_hash, role) values ($1, $2, $3, $4) returning id',
      [finalEmail, name, await hashPassword(password), inv.role]);
    await startSession(u.id);
    return null;
  } catch (err) {
    // Give the link back if the account could not be made (for example the email is taken).
    await q('update invites set used_at = null where token_hash = $1', [hashToken(token)]);
    return (err as { code?: string }).code === '23505' ? 'That email already has an account.' : 'Could not create the account. Try again.';
  }
}

/** Make a one-time join link. Returns the token to put in the link. */
export async function createInvite(email: string | null, role: 'owner' | 'editor', createdBy: string | null, days = 7): Promise<string> {
  const token = newToken();
  await q(`insert into invites (token_hash, email, role, created_by, expires_at) values ($1, $2, $3, $4, now() + $5 * interval '1 day')`,
    [hashToken(token), email, role, createdBy, days]);
  return token;
}
