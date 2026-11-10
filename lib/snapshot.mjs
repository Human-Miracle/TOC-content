// Turns the working tables into the snapshot the public site reads, and back.
// Plain JavaScript so both the Next.js app and the setup script can use it.
// `q(text, params)` must return an array of rows.

const iso = d => (d ? new Date(d).toISOString() : null);

/** Build the snapshot for one event from the working tables. */
export async function buildSnapshot(q, eventId) {
  const [ev] = await q('select * from events where id = $1', [eventId]);
  if (!ev) throw new Error('Event not found');
  const days = await q('select label, ends_at from event_days where event_id = $1 order by ends_at', [eventId]);
  const teams = await q('select id, name from teams where event_id = $1 order by position, name', [eventId]);
  const roles = await q(
    `select r.* from roles r join teams t on t.id = r.team_id where t.event_id = $1 order by r.position, r.name`, [eventId]);
  const sessions = await q('select * from sessions where event_id = $1 order by position, starts_at', [eventId]);
  const assigns = await q(
    `select a.session_id, a.role_id, p.name from assignments a
       join people p on p.id = a.person_id
       join sessions s on s.id = a.session_id
      where s.event_id = $1 order by a.position, p.name`, [eventId]);
  const pieces = await q(
    `select pc.* from pieces pc join sessions s on s.id = pc.session_id where s.event_id = $1 order by pc.position`, [eventId]);
  const refs = await q(
    `select r.* from refs r join pieces pc on pc.id = r.piece_id join sessions s on s.id = pc.session_id
      where s.event_id = $1 order by r.position`, [eventId]);

  return {
    event: {
      slug: ev.slug, shortName: ev.short_name, name: ev.name, title: ev.title, dates: ev.dates_label,
      place: ev.place, theme: ev.theme, org: ev.org, rulesLabel: ev.rules_label, rules: ev.rules,
    },
    teams: teams.map(t => t.name),
    dayEnds: Object.fromEntries(days.map(d => [d.label, iso(d.ends_at)])),
    sessions: sessions.map(s => ({
      id: s.slug, name: s.name, short: s.short_name, time: s.time_label, day: s.day_label,
      start: iso(s.starts_at), end: iso(s.ends_at), note: s.note, countsPosts: s.counts_posts,
      // A team shows in a session only when someone is on duty in it.
      teams: teams.map(t => ({
        team: t.name,
        roles: roles.filter(r => r.team_id === t.id).map(r => ({
          role: r.name, short: r.short_name, kind: r.piece_kind, daily: r.all_day, caption: r.is_caption,
          people: assigns.filter(a => a.session_id === s.id && a.role_id === r.id).map(a => a.name),
        })).filter(r => r.people.length),
      })).filter(t => t.roles.length),
      pieces: pieces.filter(p => p.session_id === s.id).map(p => ({
        kind: p.kind, title: p.title, desc: p.description, bullets: p.bullets, tip: p.tip, idea: p.is_idea,
        refs: refs.filter(r => r.piece_id === p.id).map(r => ({ url: r.url, thumb: r.thumb_url })),
      })),
    })),
  };
}

/** Save a snapshot as the live version of an event. */
export async function publish(q, eventId, by = null) {
  const snapshot = await buildSnapshot(q, eventId);
  await q('insert into publications (event_id, snapshot, published_by) values ($1, $2, $3)', [eventId, JSON.stringify(snapshot), by]);
  return snapshot;
}

/** Load a snapshot (the seed file) into the working tables as a new event. */
export async function importSnapshot(q, plan, { current = false } = {}) {
  const e = plan.event;
  const [{ id: eventId }] = await q(
    `insert into events (slug, short_name, name, title, dates_label, place, theme, org, rules_label, rules, is_current)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
    [e.slug, e.shortName, e.name, e.title, e.dates, e.place, e.theme, e.org, e.rulesLabel, e.rules, current]);
  for (const [label, ends] of Object.entries(plan.dayEnds || {}))
    await q('insert into event_days (event_id, label, ends_at) values ($1,$2,$3)', [eventId, label, ends]);

  const teamId = {}, roleId = {}, personId = {};
  for (const [i, name] of plan.teams.entries()) {
    const [r] = await q('insert into teams (event_id, name, position) values ($1,$2,$3) returning id', [eventId, name, i]);
    teamId[name] = r.id;
  }
  for (const [si, s] of plan.sessions.entries()) {
    const [{ id: sessionId }] = await q(
      `insert into sessions (event_id, slug, name, short_name, time_label, day_label, starts_at, ends_at, note, counts_posts, position)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [eventId, s.id, s.name, s.short, s.time, s.day, s.start, s.end, s.note || null, s.countsPosts !== false, si]);
    for (const t of s.teams) {
      for (const [ri, r] of t.roles.entries()) {
        const key = t.team + '|' + r.role;
        if (!roleId[key]) {
          const [row] = await q(
            `insert into roles (team_id, name, short_name, piece_kind, all_day, is_caption, position)
             values ($1,$2,$3,$4,$5,$6,$7) returning id`,
            [teamId[t.team], r.role, r.short || null, r.kind || null, !!r.daily, !!r.caption, ri]);
          roleId[key] = row.id;
        }
        for (const [pi, name] of r.people.entries()) {
          if (!personId[name]) {
            const [row] = await q('insert into people (event_id, name) values ($1,$2) returning id', [eventId, name]);
            personId[name] = row.id;
          }
          await q('insert into assignments (session_id, role_id, person_id, position) values ($1,$2,$3,$4)',
            [sessionId, roleId[key], personId[name], pi]);
        }
      }
    }
    for (const [pi, p] of s.pieces.entries()) {
      const [{ id: pieceId }] = await q(
        `insert into pieces (session_id, kind, title, description, bullets, tip, is_idea, position)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [sessionId, p.kind, p.title, p.desc, p.bullets || [], p.tip || null, !!p.idea, pi]);
      for (const [ri, r] of p.refs.entries())
        await q('insert into refs (piece_id, url, thumb_url, position) values ($1,$2,$3,$4)', [pieceId, r.url, r.thumb || null, ri]);
    }
  }
  return eventId;
}
