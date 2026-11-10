import type { ReactNode } from 'react';

/** Success or error line carried in the URL after an action. */
export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const msg = typeof sp.msg === 'string' ? sp.msg : ''; const err = typeof sp.err === 'string' ? sp.err : '';
  if (!msg && !err) return null;
  return <div className={'flash ' + (err ? 'err' : 'msg')} role="status">{err || msg}</div>;
}

/** Two-step delete that works without JavaScript. */
export function Delete({ action, id, label = 'Remove', extra }: { action: (f: FormData) => void; id: string; label?: string; extra?: ReactNode }) {
  return (
    <details className="del">
      <summary><span className="btn sm danger">{label}</span></summary>
      <form action={action} className="sure">
        <input type="hidden" name="id" value={id} />{extra}
        Sure? <button className="btn sm danger" type="submit">Yes, remove</button>
      </form>
    </details>
  );
}
