import { Delete, Flash } from '@/components/admin';
import { getAdminEvent } from '@/lib/admin';
import { q } from '@/lib/db';
import { addPerson, deletePerson, renamePerson } from '../../actions';

export default async function People({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const event = await getAdminEvent(); if (!event) return null;
  const people = await q<{ id: string; name: string; duties: number; teams: string | null }>(
    `select p.id, p.name, count(a.id)::int as duties,
            string_agg(distinct t.name, ', ') as teams
       from people p
       left join assignments a on a.person_id = p.id
       left join roles r on r.id = a.role_id left join teams t on t.id = r.team_id
      where p.event_id = $1 group by p.id order by lower(p.name)`, [event.id]);
  return (
    <>
      <h1>People</h1>
      <p className="lead">Everyone who can be put on the roster. A person shows on the public page once they have a duty.</p>
      <Flash sp={await searchParams} />
      <div className="card tint">
        <form action={addPerson} className="row">
          <label className="field"><span>Add a person</span><input type="text" name="name" required maxLength={60} placeholder="Name as it should appear" /></label>
          <button className="btn" type="submit">Add</button>
        </form>
      </div>
      <div className="list-rows">
        {people.map(p => (
          <div className="lrow" key={p.id}>
            <form action={renamePerson} className="grow">
              <input type="hidden" name="id" value={p.id} />
              <input type="text" name="name" defaultValue={p.name} required maxLength={60} aria-label={`Name of ${p.name}`} />
              <button className="btn sm ghost" type="submit">Save</button>
            </form>
            <span className="meta">{p.duties ? `${p.duties} ${p.duties === 1 ? 'duty' : 'duties'} · ${p.teams}` : 'No duties yet'}</span>
            <Delete action={deletePerson} id={p.id} />
          </div>
        ))}
        {people.length === 0 && <p className="empty">No people yet.</p>}
      </div>
    </>
  );
}
