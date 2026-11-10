import { Flash } from '@/components/admin';
import { findInvite } from '@/lib/auth';
import { MIN_PASSWORD } from '@/lib/password.mjs';
import { joinAction } from '../../actions';

export default async function Join({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams; const token = sp.token ?? '';
  const invite = await findInvite(token);
  return (
    <div className="auth">
      <div className="auth-card">
        <h1>{invite?.email ? 'Join the team' : 'Set up the admin'}</h1>
        {!invite ? <p>This link has been used or has expired. Ask an owner for a new one.</p> : (
          <>
            <p>{invite.email ? `Create your ${invite.role} account for ${invite.email}.` : 'Create the first owner account.'}</p>
            <Flash sp={sp} />
            <form action={joinAction}>
              <input type="hidden" name="token" value={token} />
              <label className="field"><span>Your name</span><input type="text" name="name" required maxLength={80} autoComplete="name" /></label>
              {!invite.email && <label className="field"><span>Email</span><input type="email" name="email" required autoComplete="username" /></label>}
              <label className="field"><span>Password (at least {MIN_PASSWORD} characters)</span><input type="password" name="password" required minLength={MIN_PASSWORD} autoComplete="new-password" /></label>
              <label className="field"><span>Password again</span><input type="password" name="password2" required minLength={MIN_PASSWORD} autoComplete="new-password" /></label>
              <button className="btn" type="submit">Create account</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
