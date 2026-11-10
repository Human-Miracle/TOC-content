import Link from 'next/link';
import { AdminNav } from '@/components/admin-client';
import { requireUser } from '@/lib/auth';
import { getAdminEvent } from '@/lib/admin';
import { logoutAction } from '../actions';

export default async function Panel({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const event = await getAdminEvent();
  return (
    <>
      <header className="adm-top">
        <div className="shell">
          <Link href="/admin" className="adm-brand">{event?.short_name ?? 'Content Plan'} <small>Admin</small></Link>
          <AdminNav owner={user.role === 'owner'} />
          <div className="adm-user">
            <span>{user.name}</span>
            <form action={logoutAction}><button type="submit">Sign out</button></form>
          </div>
        </div>
      </header>
      <main className="adm-main"><div className="shell">{children}</div></main>
    </>
  );
}
