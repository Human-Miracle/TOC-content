import { redirect } from 'next/navigation';
import { Flash } from '@/components/admin';
import { getUser } from '@/lib/auth';
import { hasDb } from '@/lib/db';
import { loginAction } from '../../actions';

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await getUser()) redirect('/admin');
  return (
    <div className="auth">
      <div className="auth-card">
        <h1>Sign in</h1>
        <p>Content Plan admin.</p>
        <Flash sp={await searchParams} />
        {hasDb() ? (
          <form action={loginAction}>
            <label className="field"><span>Email</span><input type="email" name="email" required autoComplete="username" /></label>
            <label className="field"><span>Password</span><input type="password" name="password" required autoComplete="current-password" /></label>
            <button className="btn" type="submit">Sign in</button>
          </form>
        ) : <p>No database is connected yet. Connect one in Vercel, then redeploy.</p>}
      </div>
    </div>
  );
}
