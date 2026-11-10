'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { acceptInvite, createInvite, requireOwner, requireUser, signIn, signOut } from '@/lib/auth';
import { getAdminEvent } from '@/lib/admin';
import { hasDb, pool, q } from '@/lib/db';
import { MIN_PASSWORD, cleanEmail, validEmail } from '@/lib/password.mjs';
import { publish } from '@/lib/snapshot.mjs';

// Every action below (except sign-in and join) starts with requireUser() or requireOwner():
// server actions are public endpoints, so the page-level check alone is not enough.
// Every query is also limited to the event being edited.

const text = (f: FormData, k: string, max = 200) => String(f.get(k) ?? '').trim().slice(0, max);
const KINDS = ['Inside', 'Outside', 'BTS'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (f: FormData, k: string) => { const v = String(f.get(k) ?? ''); return UUID.test(v) ? v : null; };

function back(path: string, kind: 'msg' | 'err', message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(message)}`);
}
const dup = (err: unknown) => (err as { code?: string }).code === '23505';

async function ctx() {
  const user = await requireUser();
  const event = await getAdminEvent();
  if (!event) redirect('/admin');
  return { user, event };
}

// ───────── Sign-in ─────────

export async function loginAction(f: FormData) {
  if (!hasDb()) back('/admin/login', 'err', 'No database is connected yet.');
  const email = cleanEmail(f.get('email')); const password = String(f.get('password') ?? '');
  if (!email || !password) back('/admin/login', 'err', 'Enter your email and password.');
  const err = await signIn(email, password);
  if (err) back('/admin/login', 'err', err);
  redirect('/admin');
}

export async function logoutAction() {
  await signOut();
  redirect('/admin/login');
}

export async function joinAction(f: FormData) {
  const token = text(f, 'token', 100);
  const here = `/admin/join?token=${encodeURIComponent(token)}`;
  const name = text(f, 'name', 80); const email = cleanEmail(f.get('email')); const password = String(f.get('password') ?? '');
  if (!name) back(here, 'err', 'Enter your name.');
  if (email && !validEmail(email)) back(here, 'err', 'That email does not look right.');
  if (password.length < MIN_PASSWORD) back(here, 'err', `Use a password of at least ${MIN_PASSWORD} characters.`);
  if (password.length > 200) back(here, 'err', 'That password is too long.');
  if (password !== String(f.get('password2') ?? '')) back(here, 'err', 'The two passwords do not match.');
  const err = await acceptInvite(token, name, email, password);
  if (err) back(here, 'err', err);
  redirect('/admin');
}

// ───────── Publish ─────────

export async function publishAction() {
  const { user, event } = await ctx();
  await publish(q, event.id, user.email);
  revalidatePath('/');
  back('/admin', 'msg', 'Published. The public page now shows your changes.');
}

// ───────── People ─────────

export async function addPerson(f: FormData) {
  const { event } = await ctx();
  const name = text(f, 'name', 60);
  if (!name) back('/admin/people', 'err', 'Enter a name.');
  try { await q('insert into people (event_id, name) values ($1, $2)', [event.id, name]); }
  catch (e) { if (dup(e)) back('/admin/people', 'err', `"${name}" is already on the list.`); throw e; }
  back('/admin/people', 'msg', `Added ${name}.`);
}

export async function renamePerson(f: FormData) {
  const { event } = await ctx();
  const name = text(f, 'name', 60); const pid = id(f, 'id');
  if (!name || !pid) back('/admin/people', 'err', 'Enter a name.');
  try { await q('update people set name = $1 where id = $2 and event_id = $3', [name, pid, event.id]); }
  catch (e) { if (dup(e)) back('/admin/people', 'err', `"${name}" is already on the list.`); throw e; }
  back('/admin/people', 'msg', 'Name saved.');
}

export async function deletePerson(f: FormData) {
  const { event } = await ctx();
  await q('delete from people where id = $1 and event_id = $2', [id(f, 'id'), event.id]);
  back('/admin/people', 'msg', 'Person removed, along with their duties.');
}

// ───────── Teams and roles ─────────

export async function addTeam(f: FormData) {
  const { event } = await ctx();
  const name = text(f, 'name', 60);
  if (!name) back('/admin/teams', 'err', 'Enter a team name.');
  try {
    await q(`insert into teams (event_id, name, position)
             values ($1, $2, (select coalesce(max(position), -1) + 1 from teams where event_id = $1))`, [event.id, name]);
  } catch (e) { if (dup(e)) back('/admin/teams', 'err', `There is already a team called "${name}".`); throw e; }
  back('/admin/teams', 'msg', `Added the ${name} team.`);
}

export async function renameTeam(f: FormData) {
  const { event } = await ctx();
  const name = text(f, 'name', 60);
  if (!name) back('/admin/teams', 'err', 'Enter a team name.');
  try { await q('update teams set name = $1 where id = $2 and event_id = $3', [name, id(f, 'id'), event.id]); }
  catch (e) { if (dup(e)) back('/admin/teams', 'err', `There is already a team called "${name}".`); throw e; }
  back('/admin/teams', 'msg', 'Team saved.');
}

export async function deleteTeam(f: FormData) {
  const { event } = await ctx();
  await q('delete from teams where id = $1 and event_id = $2', [id(f, 'id'), event.id]);
  back('/admin/teams', 'msg', 'Team removed, along with its roles and duties.');
}

function roleFields(f: FormData) {
  const kind = text(f, 'kind', 10);
  return {
    name: text(f, 'name', 60), short: text(f, 'short', 30) || null,
    kind: KINDS.includes(kind) ? kind : null, allDay: f.get('all_day') === 'on', caption: f.get('is_caption') === 'on',
  };
}

export async function addRole(f: FormData) {
  const { event } = await ctx();
  const r = roleFields(f); const teamId = id(f, 'team_id');
  if (!r.name) back('/admin/teams', 'err', 'Enter a role name.');
  try {
    await q(
      `insert into roles (team_id, name, short_name, piece_kind, all_day, is_caption, position)
       select t.id, $3, $4, $5, $6, $7, (select coalesce(max(position), -1) + 1 from roles where team_id = t.id)
         from teams t where t.id = $1 and t.event_id = $2`,
      [teamId, event.id, r.name, r.short, r.kind, r.allDay, r.caption]);
  } catch (e) { if (dup(e)) back('/admin/teams', 'err', `That team already has a role called "${r.name}".`); throw e; }
  back('/admin/teams', 'msg', `Added the ${r.name} role.`);
}

export async function updateRole(f: FormData) {
  const { event } = await ctx();
  const r = roleFields(f);
  if (!r.name) back('/admin/teams', 'err', 'Enter a role name.');
  try {
    await q(
      `update roles set name = $3, short_name = $4, piece_kind = $5, all_day = $6, is_caption = $7
        where id = $1 and team_id in (select id from teams where event_id = $2)`,
      [id(f, 'id'), event.id, r.name, r.short, r.kind, r.allDay, r.caption]);
  } catch (e) { if (dup(e)) back('/admin/teams', 'err', `That team already has a role called "${r.name}".`); throw e; }
  back('/admin/teams', 'msg', 'Role saved.');
}

export async function deleteRole(f: FormData) {
  const { event } = await ctx();
  await q('delete from roles where id = $1 and team_id in (select id from teams where event_id = $2)', [id(f, 'id'), event.id]);
  back('/admin/teams', 'msg', 'Role removed, along with its duties.');
}

// ───────── Sessions and days ─────────

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'session';
// "2026-11-05T16:00" from a datetime-local input, or null.
const local = (f: FormData, k: string) => { const v = text(f, k, 16); return /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(v) ? v : null; };

function sessionFields(f: FormData) {
  return {
    name: text(f, 'name', 80), short: text(f, 'short', 24), time: text(f, 'time', 60), day: text(f, 'day', 30),
    start: local(f, 'start'), end: local(f, 'end'), note: text(f, 'note', 400) || null, counts: f.get('counts_posts') === 'on',
  };
}

export async function addSession(f: FormData) {
  const { event } = await ctx();
  const s = sessionFields(f);
  if (!s.name) back('/admin/sessions', 'err', 'Enter a session name.');
  if (s.start && s.end && s.end <= s.start) back('/admin/sessions', 'err', 'The end time must be after the start time.');
  const base = slugify(s.name);
  const taken = (await q<{ slug: string }>('select slug from sessions where event_id = $1', [event.id])).map(r => r.slug);
  let slug = base; for (let i = 2; taken.includes(slug); i++) slug = `${base}-${i}`;
  await q(
    `insert into sessions (event_id, slug, name, short_name, time_label, day_label, starts_at, ends_at, note, counts_posts, position)
     values ($1, $2, $3, $4, $5, $6, $7::timestamp at time zone $11, $8::timestamp at time zone $11, $9, $10,
             (select coalesce(max(position), -1) + 1 from sessions where event_id = $1))`,
    [event.id, slug, s.name, s.short || s.name, s.time, s.day, s.start, s.end, s.note, s.counts, event.timezone]);
  back('/admin/sessions', 'msg', `Added ${s.name}.`);
}

export async function updateSession(f: FormData) {
  const { event } = await ctx();
  const s = sessionFields(f);
  if (!s.name) back('/admin/sessions', 'err', 'Enter a session name.');
  if (s.start && s.end && s.end <= s.start) back('/admin/sessions', 'err', 'The end time must be after the start time.');
  await q(
    `update sessions set name = $3, short_name = $4, time_label = $5, day_label = $6,
            starts_at = $7::timestamp at time zone $11, ends_at = $8::timestamp at time zone $11, note = $9, counts_posts = $10
      where id = $1 and event_id = $2`,
    [id(f, 'id'), event.id, s.name, s.short || s.name, s.time, s.day, s.start, s.end, s.note, s.counts, event.timezone]);
  back('/admin/sessions', 'msg', `Saved ${s.name}.`);
}

export async function deleteSession(f: FormData) {
  const { event } = await ctx();
  await q('delete from sessions where id = $1 and event_id = $2', [id(f, 'id'), event.id]);
  back('/admin/sessions', 'msg', 'Session removed, along with its roster and pieces.');
}

/** Move a session one place up or down. */
export async function moveSession(f: FormData) {
  const { event } = await ctx();
  const sid = id(f, 'id'); const dir = f.get('dir') === 'up' ? -1 : 1;
  const c = await pool().connect();
  try {
    await c.query('begin');
    const rows = (await c.query('select id from sessions where event_id = $1 order by position, starts_at for update', [event.id])).rows as { id: string }[];
    const i = rows.findIndex(r => r.id === sid); const j = i + dir;
    if (i >= 0 && j >= 0 && j < rows.length) {
      [rows[i], rows[j]] = [rows[j], rows[i]];
      for (const [pos, r] of rows.entries()) await c.query('update sessions set position = $1 where id = $2', [pos, r.id]);
    }
    await c.query('commit');
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
  redirect('/admin/sessions');
}

export async function saveDay(f: FormData) {
  const { event } = await ctx();
  const label = text(f, 'label', 30); const ends = local(f, 'ends');
  if (!label || !ends) back('/admin/sessions', 'err', 'Enter the day name and when all-day duties end.');
  await q(
    `insert into event_days (event_id, label, ends_at) values ($1, $2, $3::timestamp at time zone $4)
     on conflict (event_id, label) do update set ends_at = excluded.ends_at`, [event.id, label, ends, event.timezone]);
  back('/admin/sessions', 'msg', `Saved ${label}.`);
}

export async function deleteDay(f: FormData) {
  const { event } = await ctx();
  await q('delete from event_days where id = $1 and event_id = $2', [id(f, 'id'), event.id]);
  back('/admin/sessions', 'msg', 'Day removed.');
}

// ───────── Roster ─────────

export async function assign(f: FormData) {
  const { event } = await ctx();
  const sid = id(f, 'session_id'); const here = `/admin/roster?session=${sid ?? ''}`;
  // The session, role and person must all belong to this event.
  await q(
    `insert into assignments (session_id, role_id, person_id, position)
     select s.id, r.id, p.id, (select coalesce(max(position), -1) + 1 from assignments where session_id = s.id and role_id = r.id)
       from sessions s, roles r join teams t on t.id = r.team_id, people p
      where s.id = $1 and r.id = $2 and p.id = $3 and s.event_id = $4 and t.event_id = $4 and p.event_id = $4
     on conflict (session_id, role_id, person_id) do nothing`,
    [sid, id(f, 'role_id'), id(f, 'person_id'), event.id]);
  redirect(here);
}

export async function unassign(f: FormData) {
  const { event } = await ctx();
  const sid = id(f, 'session_id');
  await q('delete from assignments where id = $1 and session_id in (select id from sessions where event_id = $2)', [id(f, 'id'), event.id]);
  redirect(`/admin/roster?session=${sid ?? ''}`);
}

// ───────── Editors (owners only) ─────────

export type InviteResult = { link?: string; error?: string };

export async function inviteAction(_prev: InviteResult, f: FormData): Promise<InviteResult> {
  const owner = await requireOwner();
  const email = cleanEmail(f.get('email')); const role = f.get('role') === 'owner' ? 'owner' : 'editor';
  if (!validEmail(email)) return { error: 'Enter a valid email.' };
  const [exists] = await q('select 1 from users where email = $1', [email]);
  if (exists) return { error: 'That email already has an account.' };
  await q('delete from invites where email = $1 and used_at is null', [email]);
  const token = await createInvite(email, role, owner.id);
  revalidatePath('/admin/editors');
  return { link: `/admin/join?token=${token}` };
}

export async function removeUser(f: FormData) {
  const owner = await requireOwner();
  const uid = id(f, 'id');
  if (uid === owner.id) back('/admin/editors', 'err', 'You cannot remove yourself.');
  // Deleting the account also signs that person out everywhere.
  await q('delete from users where id = $1', [uid]);
  back('/admin/editors', 'msg', 'Account removed.');
}

export async function cancelInvite(f: FormData) {
  await requireOwner();
  await q('delete from invites where token_hash = $1 and used_at is null', [text(f, 'hash', 64)]);
  back('/admin/editors', 'msg', 'Link cancelled.');
}
