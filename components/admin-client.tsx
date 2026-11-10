'use client';

import { useActionState, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { InviteResult } from '@/app/admin/actions';

const NAV = [
  ['/admin', 'Overview'], ['/admin/roster', 'Roster'], ['/admin/people', 'People'],
  ['/admin/sessions', 'Sessions'], ['/admin/teams', 'Teams and roles'],
] as const;

export function AdminNav({ owner }: { owner: boolean }) {
  const path = usePathname();
  const items = owner ? [...NAV, ['/admin/editors', 'Editors'] as const] : NAV;
  return (
    <nav className="adm-nav" aria-label="Admin">
      {items.map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>{label}</Link>)}
    </nav>
  );
}

/** A select that submits its form as soon as a choice is made. */
export function AutoSelect({ name, children, label }: { name: string; children: React.ReactNode; label: string }) {
  return (
    <select name={name} aria-label={label} defaultValue="" onChange={e => { if (e.target.value) e.target.form?.requestSubmit(); }}>
      {children}
    </select>
  );
}

export function InviteForm({ action }: { action: (prev: InviteResult, f: FormData) => Promise<InviteResult> }) {
  const [state, run, pending] = useActionState(action, {});
  const [copied, setCopied] = useState(false);
  const full = state.link ? location.origin + state.link : '';
  return (
    <>
      <form action={run} className="row">
        <label className="field"><span>Email</span><input type="email" name="email" required autoComplete="off" /></label>
        <label className="field sm"><span>Role</span>
          <select name="role" defaultValue="editor"><option value="editor">Editor</option><option value="owner">Owner</option></select>
        </label>
        <button className="btn" type="submit" disabled={pending}>Create join link</button>
      </form>
      {state.error && <div className="flash err" style={{ marginTop: 12 }}>{state.error}</div>}
      {state.link && (
        <div style={{ marginTop: 14 }}>
          <p className="hint">Send this link to them. It works once, for 7 days, and is not shown again.</p>
          <div className="linkbox">{full}</div>
          <button type="button" className="btn sm ghost" style={{ marginTop: 8 }}
            onClick={() => navigator.clipboard?.writeText(full).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
      )}
    </>
  );
}
