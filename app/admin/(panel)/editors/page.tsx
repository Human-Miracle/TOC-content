import { InviteForm } from '@/components/admin-client';
import { Delete, Flash } from '@/components/admin';
import { requireOwner } from '@/lib/auth';
import { q } from '@/lib/db';
import { cancelInvite, inviteAction, removeUser } from '../../actions';

export default async function Editors({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireOwner();
  const users = await q<{ id: string; email: string; name: string; role: string }>('select id, email, name, role from users order by created_at');
  const invites = await q<{ token_hash: string; email: string; role: string; expires: string }>(
    `select token_hash, email, role, to_char(expires_at, 'DD Mon') as expires from invites
      where used_at is null and expires_at > now() and email is not null order by created_at`);
  return (
    <>
      <h1>Editors</h1>
      <p className="lead">Who can sign in. Editors can change the plan and publish. Owners can also manage this list.</p>
      <Flash sp={await searchParams} />
      <div className="card tint">
        <h2>Invite someone</h2>
        <p className="hint">Creates a one-time link. They choose their own password.</p>
        <InviteForm action={inviteAction} />
      </div>
      <div className="list-rows">
        {users.map(u => (
          <div className="lrow" key={u.id}>
            <span style={{ flex: '1 1 200px' }}><b>{u.name}</b><br /><span className="s-sub">{u.email}</span></span>
            <span className="tag">{u.role}</span>
            {u.id === me.id ? <span className="meta">You</span> : <Delete action={removeUser} id={u.id} />}
          </div>
        ))}
        {invites.map(i => (
          <div className="lrow" key={i.token_hash}>
            <span style={{ flex: '1 1 200px' }}><b>{i.email}</b><br /><span className="s-sub">Invited as {i.role}. Link expires {i.expires}.</span></span>
            <form action={cancelInvite}><input type="hidden" name="hash" value={i.token_hash} /><button className="btn sm ghost" type="submit">Cancel link</button></form>
          </div>
        ))}
      </div>
    </>
  );
}
