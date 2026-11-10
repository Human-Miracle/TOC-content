import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = { title: 'Admin · Content Plan', robots: { index: false, follow: false } };
// Admin pages depend on who is signed in, so they are never cached.
export const dynamic = 'force-dynamic';

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="adm">{children}</div>;
}
