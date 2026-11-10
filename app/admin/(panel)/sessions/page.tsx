import { Delete, Flash } from '@/components/admin';
import { getAdminEvent } from '@/lib/admin';
import { q } from '@/lib/db';
import { addSession, deleteDay, deleteSession, moveSession, saveDay, updateSession } from '../../actions';

type S = {
  id: string; name: string; short_name: string; time_label: string; day_label: string;
  start_local: string | null; end_local: string | null; note: string | null; counts_posts: boolean;
};

function Fields({ s, days }: { s?: S; days: string[] }) {
  return (
    <>
      <div className="row">
        <label className="field"><span>Name</span><input type="text" name="name" required maxLength={80} defaultValue={s?.name} placeholder="Thursday evening" /></label>
        <label className="field sm"><span>Tab name</span><input type="text" name="short" maxLength={24} defaultValue={s?.short_name} placeholder="Thu eve" /></label>
        <label className="field sm"><span>Day</span>
          <select name="day" defaultValue={s?.day_label ?? ''}>
            <option value="">No day</option>
            {days.map(d => <option key={d}>{d}</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <label className="field"><span>Time shown on the page</span><input type="text" name="time" maxLength={60} defaultValue={s?.time_label} placeholder="4PM · Opening night" /></label>
        <label className="field sm"><span>Starts</span><input type="datetime-local" name="start" defaultValue={s?.start_local ?? ''} /></label>
        <label className="field sm"><span>Ends</span><input type="datetime-local" name="end" defaultValue={s?.end_local ?? ''} /></label>
      </div>
      <label className="field"><span>Note (shown when nobody is on the roster)</span><textarea name="note" maxLength={400} defaultValue={s?.note ?? ''} /></label>
      <label className="check"><input type="checkbox" name="counts_posts" defaultChecked={s ? s.counts_posts : true} /> Show &quot;Going out this session&quot; with a post count</label>
    </>
  );
}

export default async function Sessions({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const event = await getAdminEvent(); if (!event) return null;
  const sessions = await q<S>(
    `select id, name, short_name, time_label, day_label, note, counts_posts,
            to_char(starts_at at time zone $2, 'YYYY-MM-DD"T"HH24:MI') as start_local,
            to_char(ends_at at time zone $2, 'YYYY-MM-DD"T"HH24:MI') as end_local
       from sessions where event_id = $1 order by position, starts_at`, [event.id, event.timezone]);
  const days = await q<{ id: string; label: string; ends_local: string }>(
    `select id, label, to_char(ends_at at time zone $2, 'YYYY-MM-DD"T"HH24:MI') as ends_local
       from event_days where event_id = $1 order by ends_at`, [event.id, event.timezone]);
  const dayNames = days.map(d => d.label);
  return (
    <>
      <h1>Sessions</h1>
      <p className="lead">The schedule, in the order the tabs appear. Times are in {event.timezone.replace('_', ' ')} time. The end time decides when a duty shows as &quot;Done&quot;.</p>
      <Flash sp={await searchParams} />
      <div className="stack">
        {sessions.map((s, i) => (
          <div className="card" key={s.id}>
            <details className="edit">
              <summary>
                <span className="pos">{String(i + 1).padStart(2, '0')}</span>
                <span><span className="s-title">{s.name}</span><br /><span className="s-sub">{[s.day_label, s.time_label].filter(Boolean).join(' · ') || 'No time set'}</span></span>
              </summary>
              <form action={updateSession} className="stack">
                <input type="hidden" name="id" value={s.id} />
                <Fields s={s} days={dayNames} />
                <div className="row"><button className="btn" type="submit">Save session</button></div>
              </form>
              <div className="row" style={{ marginTop: 12 }}>
                <form action={moveSession}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="up" /><button className="btn sm ghost" disabled={i === 0}>Move up</button></form>
                <form action={moveSession}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="down" /><button className="btn sm ghost" disabled={i === sessions.length - 1}>Move down</button></form>
                <Delete action={deleteSession} id={s.id} label="Remove session" />
              </div>
            </details>
          </div>
        ))}
        <div className="card tint">
          <h2>Add a session</h2>
          <form action={addSession} className="stack" style={{ marginTop: 10 }}>
            <Fields days={dayNames} />
            <div className="row"><button className="btn" type="submit">Add session</button></div>
          </form>
        </div>
        <div className="card">
          <h2>Days</h2>
          <p className="hint">All-day duties (such as picture posts) show as &quot;Done&quot; after the day&apos;s end time.</p>
          <div className="list-rows">
            {days.map(d => (
              <div className="lrow" key={d.id}>
                <form action={saveDay} className="grow">
                  <input type="hidden" name="label" value={d.label} />
                  <b style={{ minWidth: 90, alignSelf: 'center' }}>{d.label}</b>
                  <input type="datetime-local" name="ends" defaultValue={d.ends_local} required aria-label={`${d.label} ends`} />
                  <button className="btn sm ghost" type="submit">Save</button>
                </form>
                <Delete action={deleteDay} id={d.id} />
              </div>
            ))}
          </div>
          <form action={saveDay} className="row" style={{ marginTop: 12 }}>
            <label className="field"><span>New day</span><input type="text" name="label" required maxLength={30} placeholder="Monday" /></label>
            <label className="field"><span>All-day duties end</span><input type="datetime-local" name="ends" required /></label>
            <button className="btn" type="submit">Add day</button>
          </form>
        </div>
      </div>
    </>
  );
}
