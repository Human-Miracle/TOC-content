'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Plan, Role, Session } from '@/lib/types';

type Duty = { key: string; id: string; end: number; label: string; pre: string; parts: string[]; sub: string };

const pad = (n: number) => String(n).padStart(2, '0');
const rs = (r: Role) => r.short || r.role;
const kindCls = (k: string) => (k === 'Outside' ? 'outside' : k === 'BTS' ? 'bts' : 'inside');
const FAR = 8.64e15; // a duty with no end time never counts as done

const Ext = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12" /></svg>
);
const Play = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6L13 8z" fill="currentColor" /></svg>
);

/** Everyone on the roster, the teams they are on, and their duties in order. */
function indexPeople(plan: Plan) {
  const people: Record<string, Duty[]> = {};
  const teamsOf: Record<string, Set<string>> = {};
  for (const s of plan.sessions) for (const t of s.teams) for (const r of t.roles) for (const p of r.people) {
    (teamsOf[p] ||= new Set()).add(t.team);
    const list = (people[p] ||= []);
    const key = r.daily ? 'day:' + s.day : s.id;
    let d = list.find(x => x.key === key);
    if (!d) {
      const end = r.daily ? plan.dayEnds[s.day] : s.end;
      d = { key, id: s.id, end: end ? Date.parse(end) : FAR, label: r.daily ? s.day : s.name, pre: r.daily ? 'All day' : s.time.split(' · ')[0], parts: [], sub: '' };
      list.push(d);
    }
    const part = t.team + ' · ' + rs(r);
    if (!d.parts.includes(part)) d.parts.push(part);
  }
  for (const l of Object.values(people)) for (const d of l) d.sub = d.pre + ' · ' + d.parts.join(' + ');
  // Teams whose roles work on pieces see every piece opened up.
  const makerTeams = new Set<string>();
  for (const s of plan.sessions) for (const t of s.teams) if (t.roles.some(r => r.kind)) makerTeams.add(t.team);
  return { people, teamsOf, makerTeams };
}

export default function PlanView({ plan }: { plan: Plan }) {
  const { sessions, event } = plan;
  const { people, teamsOf, makerTeams } = useMemo(() => indexPeople(plan), [plan]);
  const meKey = `${event.slug}-me`;

  const [me, setMe] = useState('');
  const [current, setCurrent] = useState(sessions[0]?.id ?? '');
  const [now, setNow] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const reduced = useRef(false);

  const nextDutyOf = useCallback((who: string, at: number) => (who && people[who] ? people[who].find(d => d.end > at) || null : null), [people]);

  // After load: remember who you are and open the right session.
  useEffect(() => {
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const at = Date.now();
    let who = '';
    try { who = localStorage.getItem(meKey) || ''; } catch {}
    if (!people[who]) who = '';
    const hash = location.hash.slice(1);
    let id = sessions.find(s => s.id === hash)?.id;
    if (!id) { const n = nextDutyOf(who, at); id = n ? n.id : who ? people[who][0].id : sessions[0]?.id; }
    setNow(at); setMe(who); if (id) setCurrent(id);
    const onHash = () => { const h = location.hash.slice(1); if (sessions.some(s => s.id === h)) setCurrent(h); };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, [meKey, people, sessions, nextDutyOf]);

  // Keep the selected tab in view.
  useEffect(() => {
    const t = tabsRef.current; const b = t?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (t && b) t.scrollTo({ left: b.offsetLeft - (t.clientWidth - b.offsetWidth) / 2, behavior: reduced.current ? 'auto' : 'smooth' });
  }, [current]);

  // Shadow under the tab bar once it sticks.
  useEffect(() => {
    const el = planRef.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => el.classList.toggle('stuck', e.intersectionRatio < 1), { threshold: [1], rootMargin: '-1px 0px 0px 0px' });
    io.observe(el); return () => io.disconnect();
  }, []);

  const swap = (fn: () => void) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!reduced.current && doc.startViewTransition) doc.startViewTransition(() => flushSync(fn)); else fn();
  };
  const go = (id: string, scroll: boolean) => {
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    swap(() => setCurrent(id));
    if (scroll) planRef.current?.scrollIntoView({ behavior: reduced.current ? 'auto' : 'smooth', block: 'start' });
  };
  const pick = (who: string) => {
    try { localStorage.setItem(meKey, who); } catch {}
    const at = Date.now(); const n = nextDutyOf(who, at);
    if (n) history.replaceState(null, '', '#' + n.id);
    swap(() => { setNow(at); setMe(who); if (n) setCurrent(n.id); });
  };

  const myRoles = (s: Session) => s.teams.flatMap(t => t.roles.filter(r => me && r.people.includes(me)).map(r => ({ team: t.team, role: r })));
  const mark = (names: string[]) => names.map((x, i) => <Fragment key={x}>{i > 0 && ', '}{x === me ? <mark>{x}</mark> : x}</Fragment>);

  const next = nextDutyOf(me, now);
  const full = !me || [...(teamsOf[me] || [])].some(t => makerTeams.has(t));
  const idx = Math.max(0, sessions.findIndex(s => s.id === current));
  const s = sessions[idx];
  if (!s) return <main><p className="shell who">No sessions have been published yet.</p></main>;

  const roles = myRoles(s);
  const has = (t: Session['teams'][number]) => t.roles.some(r => r.people.includes(me));
  const teamsOrdered = [...s.teams].sort((x, y) => (has(y) ? 1 : 0) - (has(x) ? 1 : 0));
  const capt = s.teams.flatMap(t => t.roles).find(r => r.caption)?.people ?? [];
  const posts = s.pieces.filter(p => p.kind !== 'BTS').length;
  const prev = sessions[idx - 1], nxt = sessions[idx + 1];
  const firstTeam = (p: string) => plan.teams.find(t => teamsOf[p].has(t));

  return (
    <main>
      <section className="shell who" id="who-section">
        <div className="who-head">
          <p className="eyebrow"><i>01</i> You</p>
          <h2><label htmlFor="who">Who are you?</label></h2>
        </div>
        <div className="who-body">
          <div className="select-wrap">
            <select id="who" value={me} onChange={e => pick(e.target.value)}>
              <option value="">Pick your name</option>
              {plan.teams.map(team => (
                <optgroup key={team} label={team}>
                  {Object.keys(people).filter(p => firstTeam(p) === team).sort((a, b) => a.localeCompare(b)).map(p => <option key={p} value={p}>{p}</option>)}
                </optgroup>
              ))}
            </select>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg>
          </div>
          {!me && <p className="howto">Pick your name once. Your duties show up here, and this page remembers you on this phone.</p>}
          {next && (
            <div className="next" role="button" tabIndex={0} onClick={() => go(next.id, true)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(next.id, true); } }}>
              <span>You&apos;re up next</span><b>{next.label}</b><em>{next.sub}</em>
            </div>
          )}
          <div className="duties">
            {me && people[me]?.map((d, i) => (
              <button key={d.key} type="button" style={{ '--i': i } as React.CSSProperties}
                className={'duty' + (d.end <= now ? ' past' : '') + (next === d ? ' isnext' : '')} onClick={() => go(d.id, true)}>
                <div><b>{d.label}</b><span>{d.sub}</span></div><i>{d.end <= now ? 'Done' : 'Open ›'}</i>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="tabs-wrap" id="plan" ref={planRef}>
        <div className="shell tabs-inner">
          <p className="eyebrow tabs-label"><i>02</i> Sessions</p>
          <div className="tabs" role="tablist" aria-label="Sessions" ref={tabsRef}>
            {sessions.map((x, i) => (
              <button key={x.id} type="button" role="tab" aria-selected={x.id === s.id} tabIndex={x.id === s.id ? 0 : -1}
                className={'tab' + (myRoles(x).length ? ' mine' : '')} onClick={() => go(x.id, false)}
                onKeyDown={e => {
                  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                  e.preventDefault();
                  go(sessions[(i + (e.key === 'ArrowRight' ? 1 : sessions.length - 1)) % sessions.length].id, false);
                  requestAnimationFrame(() => tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
                }}>
                <small>{pad(i + 1)}</small>{x.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="shell view" id="view" aria-live="polite" key={s.id + '|' + me}>
        <aside className="sess">
          <div className="sess-head">
            <p className="sess-idx">{pad(idx + 1)}<span> / {pad(sessions.length)}</span>{s.day && <em>{s.day}</em>}</p>
            <h2>{s.name}</h2>
            <p className="sess-time">{s.time}{roles.length > 0 && ` · You're on ${roles.map(r => rs(r.role)).join(' + ')}`}</p>
          </div>
          {s.teams.length > 0 ? (
            <>
              <div className="count">On duty</div>
              <div className="teams">
                {teamsOrdered.map(t => (
                  <div key={t.team} className={'tblock' + (has(t) ? ' mine' : '')}>
                    <div className="tname">{t.team}</div>
                    <div className="team">
                      {t.roles.map(r => <div key={r.role}><span>{rs(r)}{r.daily ? ' · all day' : ''}</span>{mark(r.people)}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : s.note ? <div className="note">{s.note}</div> : null}
          {full && event.rules && <p className="rules"><b>{event.rulesLabel}:</b> {event.rules}</p>}
        </aside>

        <div className="list">
          <div className="count">{s.countsPosts ? `Going out this session · ${posts}` : 'Pieces'}</div>
          {!full && <p className="hint2">Tap a piece to see what it is.</p>}
          <div className="pieces">
            {s.pieces.map((p, i) => {
              const yours = roles.some(r => r.role.kind === p.kind);
              const head = (
                <div className="pc-top">
                  <span className="num">{pad(i + 1)}</span><span className={'k ' + kindCls(p.kind)}>{p.kind}</span>
                  {yours && <span className="yt">● Your team</span>}
                </div>
              );
              const body = (
                <>
                  <div className="d">{p.desc}{p.bullets.length > 0 && <ul>{p.bullets.map(b => <li key={b}>{b}</li>)}</ul>}</div>
                  {p.tip && <div className="tip"><b>Tip</b>{p.tip}</div>}
                  <div className={'refs' + (p.idea ? ' is-idea' : '')}>
                    {p.idea ? <span className="idea">Idea · no reference</span> : p.refs.map((r, j) => {
                      const yt = r.url.includes('youtu');
                      return (
                        <a key={r.url + j} className="ref" href={r.url} target="_blank" rel="noopener" style={{ '--j': j } as React.CSSProperties}>
                          <span className={'ref-img' + (r.thumb ? '' : ' noimg')}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {r.thumb && <img src={r.thumb} alt="" loading="lazy" decoding="async" />}
                            <span className="play"><Play /></span><span className="src">{yt ? 'YouTube' : 'Instagram'}</span>
                          </span>
                          <span className="ref-label">Watch ref {j + 1}{yt ? ' (YouTube)' : ''} <Ext /></span>
                        </a>
                      );
                    })}
                  </div>
                </>
              );
              const cap = capt.length > 0 && p.kind !== 'BTS' ? <div className="cap"><b>Caption</b> {mark(capt)}</div> : null;
              const style = { '--i': i } as React.CSSProperties;
              return full ? (
                <article key={i} className={'pc' + (yours ? ' yours' : '')} style={style}>{head}<h3>{p.title}</h3>{body}{cap}</article>
              ) : (
                <div key={i} className="pc-wrap">
                  <details className="pc" style={style}><summary>{head}<h3>{p.title}</h3></summary>{body}</details>
                  {cap && <div className="capx">{cap}</div>}
                </div>
              );
            })}
          </div>
          <nav className="pager" aria-label="More sessions">
            {prev ? <button type="button" onClick={() => go(prev.id, true)}><span>← Previous</span><b>{prev.name}</b></button> : <i />}
            {nxt && <button type="button" className="nx" onClick={() => go(nxt.id, true)}><span>Next →</span><b>{nxt.name}</b></button>}
          </nav>
        </div>
      </section>
    </main>
  );
}
