/* TOC'26 Content Plan. Same behaviour as the original page: pick your name, see your duties, browse sessions. */
(function () {
  const SESSIONS = window.SESSIONS;
  const $ = id => document.getElementById(id);
  const ROLE_SHORT = { 'Inside shooting': 'Shooting', 'Inside editing': 'Editing', 'CD / comms': 'CD / comms' };
  const rs = r => ROLE_SHORT[r] || r;
  const TEAM_ORDER = ['Video', 'Social media', 'Writers'];
  const START = { 'thu-eve': '2026-11-05T16:00:00+01:00', 'fri-morn': '2026-11-06T08:30:00+01:00', 'fri-eve': '2026-11-06T16:00:00+01:00', 'sat-morn': '2026-11-07T08:30:00+01:00', 'sat-eve': '2026-11-07T16:00:00+01:00', 'sun-morn': '2026-11-08T08:30:00+01:00' };
  const DAYEND = { 'Thursday': '2026-11-05T23:00:00+01:00', 'Friday': '2026-11-06T23:00:00+01:00', 'Saturday': '2026-11-07T23:00:00+01:00', 'Sunday': '2026-11-08T16:00:00+01:00' };
  const sessEnd = id => new Date(new Date(START[id]).getTime() + (id === 'sun-morn' ? 5 : 4.5) * 3600e3);
  const split = p => p.split(',').map(x => x.trim()).filter(Boolean);
  const pad = n => String(n).padStart(2, '0');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // people -> duties
  const people = {}, teamsOf = {};
  SESSIONS.forEach(s => s.teams.forEach(t => t.roles.forEach(r => split(r.people).forEach(p => {
    (teamsOf[p] = teamsOf[p] || new Set()).add(t.team);
    const list = (people[p] = people[p] || []);
    const key = r.daily ? 'day:' + s.day : s.id;
    let d = list.find(x => x.key === key);
    if (!d) {
      d = { key, id: s.id, end: r.daily ? new Date(DAYEND[s.day]) : sessEnd(s.id), label: r.daily ? s.day : s.name, pre: r.daily ? 'All day' : s.time.split(' · ')[0], parts: [] };
      list.push(d);
    }
    const part = t.team + ' · ' + rs(r.role);
    if (!d.parts.includes(part)) d.parts.push(part);
  }))));
  Object.values(people).forEach(l => l.forEach(d => d.sub = d.pre + ' · ' + d.parts.join(' + ')));

  const sel = $('who');
  TEAM_ORDER.forEach(team => {
    const g = document.createElement('optgroup'); g.label = team;
    Object.keys(people).filter(p => teamsOf[p].has(team)).sort((a, b) => a.localeCompare(b)).forEach(p => {
      if (team !== [...teamsOf[p]].sort((a, b) => TEAM_ORDER.indexOf(a) - TEAM_ORDER.indexOf(b))[0]) return;
      const o = document.createElement('option'); o.value = p; o.textContent = p; g.appendChild(o);
    });
    sel.appendChild(g);
  });

  let me = ''; try { me = localStorage.getItem('toc26-me') || ''; } catch (e) {}
  if (!people[me]) me = ''; sel.value = me;
  function nextDuty() { if (!me) return null; const now = new Date(); return people[me].find(d => d.end > now) || null; }
  let current = (location.hash || '').slice(1);
  if (!SESSIONS.find(s => s.id === current)) { const n = nextDuty(); current = n ? n.id : (me ? people[me][0].id : SESSIONS[0].id); }

  const ext = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg>';
  const kindCls = k => k === 'Outside' ? 'outside' : k === 'BTS' ? 'bts' : 'inside';
  function myRoles(s) { const out = []; s.teams.forEach(t => t.roles.forEach(r => { if (me && split(r.people).includes(me)) out.push({ team: t.team, role: r.role }); })); return out; }
  const onVideo = () => !me || teamsOf[me].has('Video');
  function roleMatches(r, kind) { return r.team === 'Video' && ((kind === 'Inside' && (r.role === 'Inside shooting' || r.role === 'Inside editing')) || (kind === 'Outside' && r.role === 'Outside') || (kind === 'BTS' && r.role === 'BTS')); }
  const mark = p => split(p).map(x => x === me ? `<mark>${x}</mark>` : x).join(', ');

  function renderDuties() {
    const box = $('duties'); box.innerHTML = ''; const nx = $('next');
    const n = nextDuty();
    if (n) {
      nx.hidden = false;
      nx.innerHTML = `<span>You're up next</span><b>${n.label}</b><em>${n.sub}</em>`;
      nx.onclick = () => go(n.id, true); nx.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(n.id, true); } };
      nx.setAttribute('role', 'button'); nx.tabIndex = 0;
    } else nx.hidden = true;
    document.querySelector('.howto').hidden = !!me;
    if (!me) return; const now = new Date();
    people[me].forEach((d, i) => {
      const b = document.createElement('button');
      b.className = 'duty' + (d.end <= now ? ' past' : '') + (n && d === n ? ' isnext' : ''); b.type = 'button';
      b.style.setProperty('--i', i);
      b.innerHTML = `<div><b>${d.label}</b><span>${d.sub}</span></div><i>${d.end <= now ? 'Done' : 'Open ›'}</i>`;
      b.onclick = () => go(d.id, true); box.appendChild(b);
    });
  }

  function renderTabs() {
    const t = $('tabs'); t.innerHTML = '';
    SESSIONS.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'tab' + (myRoles(s).length ? ' mine' : ''); b.type = 'button'; b.setAttribute('role', 'tab');
      b.innerHTML = `<small>${pad(i + 1)}</small>${s.short}`;
      b.setAttribute('aria-selected', s.id === current);
      b.tabIndex = s.id === current ? 0 : -1;
      b.onclick = () => go(s.id, false);
      b.onkeydown = e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const nx = SESSIONS[(i + (e.key === 'ArrowRight' ? 1 : SESSIONS.length - 1)) % SESSIONS.length];
        go(nx.id, false); t.querySelector('[aria-selected="true"]').focus();
      };
      t.appendChild(b);
      if (s.id === current) requestAnimationFrame(() => { t.scrollTo({ left: b.offsetLeft - (t.clientWidth - b.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' }); });
    });
  }

  function viewHTML() {
    const idx = SESSIONS.findIndex(x => x.id === current); const s = SESSIONS[idx]; const roles = myRoles(s);
    let duty = '';
    if (s.teams.length) {
      const has = t => t.roles.some(r => split(r.people).includes(me));
      const ord = [...s.teams].sort((x, y) => (has(y) ? 1 : 0) - (has(x) ? 1 : 0));
      duty = '<div class="count">On duty</div><div class="teams">' + ord.map(t => `<div class="tblock${has(t) ? ' mine' : ''}"><div class="tname">${t.team}</div><div class="team">${t.roles.map(r => `<div><span>${rs(r.role)}${r.daily ? ' · all day' : ''}</span>${mark(r.people)}</div>`).join('')}</div></div>`).join('') + '</div>';
    } else if (s.note) duty = `<div class="note">${s.note}</div>`;
    const writer = s.teams.find(t => t.team === 'Writers'); const capt = writer ? writer.roles[0].people : '';
    const full = onVideo();
    const posts = s.pieces.filter(p => p.kind !== 'BTS').length;
    const cards = s.pieces.map((p, i) => {
      const yours = roles.some(r => roleMatches(r, p.kind));
      const refs = p.idea ? '<span class="idea">Idea · no reference</span>' : p.refs.map((u, j) => `<a class="ref" href="${u}" target="_blank" rel="noopener">Watch ref ${j + 1}${u.includes('youtu') ? ' (YouTube)' : ''} ${ext}</a>`).join('');
      const cap = (capt && p.kind !== 'BTS') ? `<div class="cap"><b>Caption</b> ${mark(capt)}</div>` : '';
      const body = `<div class="d">${p.desc}</div>${p.tip ? `<div class="tip"><b>Tip</b>${p.tip}</div>` : ''}<div class="refs">${refs}</div>`;
      const head = `<div class="pc-top"><span class="num">${pad(i + 1)}</span><span class="k ${kindCls(p.kind)}">${p.kind}</span>${yours ? '<span class="yt">● Your team</span>' : ''}</div>`;
      if (full) return `<article class="pc${yours ? ' yours' : ''}" style="--i:${i}">${head}<h3>${p.title}</h3>${body}${cap}</article>`;
      return `<details class="pc" style="--i:${i}"><summary>${head}<h3>${p.title}</h3></summary>${body}</details>${cap ? `<div class="capx">${cap}</div>` : ''}`;
    }).join('');
    const rules = full ? `<p class="rules"><b>Video team:</b> music comes from Nate's approved playlist only, and every edit carries the Gloryzone / TOC'26 look. Teams split their pieces among themselves.</p>` : '';
    const who = roles.length ? ` · You're on ${roles.map(r => rs(r.role)).join(' + ')}` : '';
    const label = s.id === 'after' ? 'Pieces' : `Going out this session · ${posts}`;
    const hint = full ? '' : '<p class="hint2">Tap a piece to see what it is.</p>';
    const prev = SESSIONS[idx - 1], next = SESSIONS[idx + 1];
    const pager = `<nav class="pager" aria-label="More sessions">${prev ? `<button type="button" data-go="${prev.id}"><span>← Previous</span><b>${prev.name}</b></button>` : '<i></i>'}${next ? `<button type="button" class="nx" data-go="${next.id}"><span>Next →</span><b>${next.name}</b></button>` : ''}</nav>`;
    return `<aside class="sess">
      <div class="sess-head"><p class="sess-idx">${pad(idx + 1)}<span> / ${pad(SESSIONS.length)}</span>${s.day ? `<em>${s.day}</em>` : ''}</p><h2>${s.name}</h2><p class="sess-time">${s.time}${who}</p></div>
      ${duty}${rules}
    </aside>
    <div class="list"><div class="count">${label}</div>${hint}<div class="pieces">${cards}</div>${pager}</div>`;
  }

  function renderView() {
    const v = $('view');
    v.innerHTML = viewHTML();
    v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go, true));
  }

  function swap(fn) {
    if (!reduced && document.startViewTransition) document.startViewTransition(fn); else fn();
  }

  function go(id, scroll) {
    current = id; if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    swap(() => { renderTabs(); renderView(); });
    if (scroll) $('plan').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  sel.onchange = () => {
    me = sel.value; try { localStorage.setItem('toc26-me', me); } catch (e) {}
    const n = nextDuty(); if (n) { current = n.id; history.replaceState(null, '', '#' + n.id); }
    renderDuties(); swap(() => { renderTabs(); renderView(); });
  };
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (SESSIONS.find(s => s.id === h) && h !== current) { current = h; renderTabs(); renderView(); }
  });

  // Marquee: the page's own words, repeated.
  const words = ['The Outpouring Camp \'26', 'Regnum: The Supply of the Spirit', 'Gloryzone Global', 'Video', 'Social media', 'Writers', 'Nov 5–8, 2026', 'Jos'];
  const run = words.map(w => `<span>${w}</span><i></i>`).join('');
  $('marquee').innerHTML = `<div>${run}</div><div>${run}</div>`;

  // Theme toggle
  $('theme').onclick = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('toc26-theme', root.dataset.theme); } catch (e) {}
  };

  // Sticky tab bar shadow + hero parallax
  const tw = $('plan');
  new IntersectionObserver(([e]) => tw.classList.toggle('stuck', e.intersectionRatio < 1), { threshold: [1], rootMargin: '-1px 0px 0px 0px' }).observe(tw);
  if (!reduced) {
    const ring = document.querySelector('.ring'); let tick = false;
    addEventListener('scroll', () => { if (tick) return; tick = true; requestAnimationFrame(() => { ring.style.setProperty('--s', Math.min(scrollY, 1200)); tick = false; }); }, { passive: true });
  }

  renderDuties(); renderTabs(); renderView();
  document.documentElement.classList.add('ready');
})();
