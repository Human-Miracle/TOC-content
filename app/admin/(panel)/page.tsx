import Link from 'next/link';
import { Flash } from '@/components/admin';
import { getAdminEvent, publishState } from '@/lib/admin';
import { q } from '@/lib/db';
import { publishAction } from '../actions';

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const event = await getAdminEvent();
  if (!event) return <><h1>No event yet</h1><p className="lead">The database has no current event. Redeploy to load the TOC&apos;26 plan.</p></>;
  const state = await publishState(event.id);
  const [c] = await q<{ people: number; sessions: number; duties: number; pieces: number }>(
    `select (select count(*)::int from people where event_id = $1) as people,
            (select count(*)::int from sessions where event_id = $1) as sessions,
            (select count(*)::int from assignments a join sessions s on s.id = a.session_id where s.event_id = $1) as duties,
            (select count(*)::int from pieces p join sessions s on s.id = p.session_id where s.event_id = $1) as pieces`, [event.id]);
  const when = state.publishedAt
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: event.timezone }).format(state.publishedAt)
    : null;
  return (
    <>
      <h1>{event.name}</h1>
      <p className="lead">Changes you make here are saved as you go, but the public page only changes when you publish.</p>
      <Flash sp={await searchParams} />
      <div className={'pub' + (state.changed ? ' changed' : '')}>
        <div>
          <b>{state.changed ? 'You have unpublished changes' : 'The public page is up to date'}</b>
          <span>{when ? `Last published ${when}${state.publishedBy ? ` by ${state.publishedBy}` : ''}` : 'Never published'}</span>
        </div>
        {state.changed && <form action={publishAction}><button className="btn" type="submit">Publish now</button></form>}
      </div>
      <div className="grid2">
        <Link className="card" href="/admin/roster" style={{ textDecoration: 'none', color: 'inherit' }}><h2>Roster</h2><p className="hint">{c.duties} duties across {c.sessions} sessions. Put people on roles.</p></Link>
        <Link className="card" href="/admin/people" style={{ textDecoration: 'none', color: 'inherit' }}><h2>People</h2><p className="hint">{c.people} people. Add, rename or remove.</p></Link>
        <Link className="card" href="/admin/sessions" style={{ textDecoration: 'none', color: 'inherit' }}><h2>Sessions</h2><p className="hint">{c.sessions} sessions. Names, times, order and days.</p></Link>
        <Link className="card" href="/admin/teams" style={{ textDecoration: 'none', color: 'inherit' }}><h2>Teams and roles</h2><p className="hint">Who does what kind of work.</p></Link>
      </div>
      <p className="hint">{c.pieces} pieces and their references are edited in the next step of the build. <a href="/" target="_blank">Open the public page</a></p>
    </>
  );
}
