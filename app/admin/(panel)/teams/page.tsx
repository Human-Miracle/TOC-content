import { Delete, Flash } from '@/components/admin';
import { getAdminEvent } from '@/lib/admin';
import { q } from '@/lib/db';
import { addRole, addTeam, deleteRole, deleteTeam, renameTeam, updateRole } from '../../actions';

type Role = { id: string; team_id: string; name: string; short_name: string | null; piece_kind: string | null; all_day: boolean; is_caption: boolean };

function RoleFields({ r }: { r?: Role }) {
  return (
    <>
      <label className="field"><span>Role name</span><input type="text" name="name" required maxLength={60} defaultValue={r?.name} /></label>
      <label className="field sm"><span>Short name</span><input type="text" name="short" maxLength={30} defaultValue={r?.short_name ?? ''} placeholder="Optional" /></label>
      <label className="field sm"><span>Works on</span>
        <select name="kind" defaultValue={r?.piece_kind ?? ''}>
          <option value="">No pieces</option><option>Inside</option><option>Outside</option><option>BTS</option>
        </select>
      </label>
      <label className="check"><input type="checkbox" name="all_day" defaultChecked={r?.all_day} /> All day</label>
      <label className="check"><input type="checkbox" name="is_caption" defaultChecked={r?.is_caption} /> Writes captions</label>
    </>
  );
}

export default async function Teams({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const event = await getAdminEvent(); if (!event) return null;
  const teams = await q<{ id: string; name: string }>('select id, name from teams where event_id = $1 order by position, name', [event.id]);
  const roles = await q<Role>(
    `select r.* from roles r join teams t on t.id = r.team_id where t.event_id = $1 order by r.position, r.name`, [event.id]);
  return (
    <>
      <h1>Teams and roles</h1>
      <p className="lead">
        &quot;Works on&quot; links a role to a kind of piece, so those people see &quot;Your team&quot; on matching pieces.
        &quot;All day&quot; means the duty lasts the whole day, not one session.
      </p>
      <Flash sp={await searchParams} />
      <div className="stack">
        {teams.map(t => (
          <div className="card" key={t.id}>
            <div className="lrow" style={{ border: 0, padding: 0, marginBottom: 12 }}>
              <form action={renameTeam} className="grow">
                <input type="hidden" name="id" value={t.id} />
                <input type="text" name="name" defaultValue={t.name} required maxLength={60} aria-label="Team name" style={{ fontWeight: 800 }} />
                <button className="btn sm ghost" type="submit">Save</button>
              </form>
              <Delete action={deleteTeam} id={t.id} label="Remove team" />
            </div>
            {roles.filter(r => r.team_id === t.id).map(r => (
              <div className="rrole" key={r.id}>
                <form action={updateRole} className="row">
                  <input type="hidden" name="id" value={r.id} />
                  <RoleFields r={r} />
                  <button className="btn sm ghost" type="submit">Save</button>
                </form>
                <Delete action={deleteRole} id={r.id} label="Remove role" />
              </div>
            ))}
            <div className="rrole">
              <span className="lbl">Add a role to {t.name}</span>
              <form action={addRole} className="row">
                <input type="hidden" name="team_id" value={t.id} />
                <RoleFields />
                <button className="btn sm" type="submit">Add role</button>
              </form>
            </div>
          </div>
        ))}
        <div className="card tint">
          <form action={addTeam} className="row">
            <label className="field"><span>Add a team</span><input type="text" name="name" required maxLength={60} /></label>
            <button className="btn" type="submit">Add team</button>
          </form>
        </div>
      </div>
    </>
  );
}
