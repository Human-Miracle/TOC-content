import Link from 'next/link';
import { AutoSelect } from '@/components/admin-client';
import { Flash } from '@/components/admin';
import { getAdminEvent } from '@/lib/admin';
import { q } from '@/lib/db';
import { assign, unassign } from '../../actions';

export default async function Roster({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const event = await getAdminEvent(); if (!event) return null;
  const sessions = await q<{ id: string; name: string; short_name: string; time_label: string }>(
    'select id, name, short_name, time_label from sessions where event_id = $1 order by position, starts_at', [event.id]);
  const current = sessions.find(s => s.id === sp.session) ?? sessions[0];
  if (!current) return <><h1>Roster</h1><p className="lead">Add a session first.</p></>;
  const teams = await q<{ id: string; name: string }>('select id, name from teams where event_id = $1 order by position, name', [event.id]);
  const roles = await q<{ id: string; team_id: string; name: string; all_day: boolean; piece_kind: string | null; is_caption: boolean }>(
    `select r.id, r.team_id, r.name, r.all_day, r.piece_kind, r.is_caption from roles r join teams t on t.id = r.team_id
      where t.event_id = $1 order by r.position, r.name`, [event.id]);
  const people = await q<{ id: string; name: string }>('select id, name from people where event_id = $1 order by lower(name)', [event.id]);
  const assigned = await q<{ id: string; role_id: string; person_id: string; name: string }>(
    `select a.id, a.role_id, a.person_id, p.name from assignments a join people p on p.id = a.person_id
      where a.session_id = $1 order by a.position, p.name`, [current.id]);

  return (
    <>
      <h1>Roster</h1>
      <p className="lead">Pick a session, then put people on each role. Pick a name to add it. Press × to take someone off.</p>
      <Flash sp={sp} />
      <nav className="sess-pick" aria-label="Sessions">
        {sessions.map(s => <Link key={s.id} href={`/admin/roster?session=${s.id}`} aria-current={s.id === current.id}>{s.short_name}</Link>)}
      </nav>
      <h2 style={{ marginBottom: 12 }}>{current.name} <span className="s-sub">{current.time_label}</span></h2>
      <div className="grid2">
        {teams.map(t => (
          <div className="card" key={t.id}>
            <h2>{t.name}</h2>
            {roles.filter(r => r.team_id === t.id).map(r => {
              const on = assigned.filter(a => a.role_id === r.id);
              const free = people.filter(p => !on.some(a => a.person_id === p.id));
              return (
                <div className="rrole" key={r.id}>
                  <div className="rrole-head">
                    <b>{r.name}</b>
                    {r.all_day && <span className="tag">All day</span>}
                    {r.piece_kind && <span className="tag">{r.piece_kind}</span>}
                    {r.is_caption && <span className="tag">Captions</span>}
                  </div>
                  <div className="chips">
                    {on.map(a => (
                      <form action={unassign} key={a.id} className="chip">
                        <input type="hidden" name="id" value={a.id} /><input type="hidden" name="session_id" value={current.id} />
                        {a.name}<button type="submit" aria-label={`Take ${a.name} off ${r.name}`}>×</button>
                      </form>
                    ))}
                    {on.length === 0 && <span className="empty">Nobody yet</span>}
                    <form action={assign} className="add-person">
                      <input type="hidden" name="session_id" value={current.id} /><input type="hidden" name="role_id" value={r.id} />
                      <AutoSelect name="person_id" label={`Add a person to ${r.name}`}>
                        <option value="">+ Add person</option>
                        {free.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </AutoSelect>
                      <noscript><button className="btn sm" type="submit">Add</button></noscript>
                    </form>
                  </div>
                </div>
              );
            })}
            {roles.every(r => r.team_id !== t.id) && <p className="empty">No roles yet. Add them under Teams and roles.</p>}
          </div>
        ))}
      </div>
    </>
  );
}
