/* Armed and Dangerous'27 Content Plan. Same behaviour as the original page: pick your name, see your duties, browse sessions. */
(function () {
  const SESSIONS = window.SESSIONS;
  const $ = id => document.getElementById(id);
  const ROLE_SHORT = { 'Inside shooting': 'Shooting', 'Inside editing': 'Editing', 'CD / comms': 'CD / comms' };
  const rs = r => ROLE_SHORT[r] || r;
  const TEAM_ORDER = ['Video', 'Social media', 'Writers'];
  const START = { 'thu-eve': '2027-07-15T16:00:00+01:00', 'fri-morn': '2027-07-16T08:30:00+01:00', 'fri-eve': '2027-07-16T16:00:00+01:00', 'sat-morn': '2027-07-17T08:30:00+01:00', 'sat-eve': '2027-07-17T16:00:00+01:00', 'sun-morn': '2027-07-18T08:30:00+01:00' };
  const DAYEND = { 'Thursday': '2027-07-15T23:00:00+01:00', 'Friday': '2027-07-16T23:00:00+01:00', 'Saturday': '2027-07-17T23:00:00+01:00', 'Sunday': '2027-07-18T16:00:00+01:00' };
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

  // Name picker: our own dropdown (a bottom sheet on phones) instead of the system select.
  const pick = $('who'), pop = $('who-pop'), list = $('who-list'), back = $('who-back'), opts = [];
  function addOpt(parent, value, text) {
    const li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = 'who-o' + opts.length;
    li.dataset.value = value; li.textContent = text; parent.appendChild(li); opts.push(li);
  }
  addOpt(list, '', 'Just browsing');
  TEAM_ORDER.forEach((team, gi) => {
    const names = Object.keys(people).filter(p => teamsOf[p].has(team)).sort((a, b) => a.localeCompare(b))
      .filter(p => team === [...teamsOf[p]].sort((a, b) => TEAM_ORDER.indexOf(a) - TEAM_ORDER.indexOf(b))[0]);
    if (!names.length) return;
    const g = document.createElement('li'); g.setAttribute('role', 'presentation');
    g.innerHTML = `<div class="pick-group" id="who-g${gi}">${team}</div><ul role="group" aria-labelledby="who-g${gi}"></ul>`;
    list.appendChild(g); names.forEach(p => addOpt(g.lastChild, p, p));
  });

  let me = ''; try { me = localStorage.getItem('ad27-me') || ''; } catch (e) {}
  if (!people[me]) me = '';
  function nextDuty() { if (!me) return null; const now = new Date(); return people[me].find(d => d.end > now) || null; }
  let current = (location.hash || '').slice(1);
  if (!SESSIONS.find(s => s.id === current)) { const n = nextDuty(); current = n ? n.id : (me ? people[me][0].id : SESSIONS[0].id); }

  const ext = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg>';
  const play = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6L13 8z" fill="currentColor"/></svg>';
  // Thumbnail file name: the post or video id from the reference link.
  // References with no public preview image (checked 10 Nov 2026).
  const NO_THUMB = new Set(['DeNHKvtIMlE']);
  const refId = u => u.replace(/\/+$/, '').split('/').pop();
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
      const refs = p.idea ? '<span class="idea">Idea · no reference</span>' : p.refs.map((u, j) => {
        const yt = u.includes('youtu');
        return `<a class="ref" href="${u}" target="_blank" rel="noopener" style="--j:${j}"><span class="ref-img${NO_THUMB.has(refId(u)) ? ' noimg' : ''}">${NO_THUMB.has(refId(u)) ? '' : `<img src="assets/refs/${refId(u)}.webp" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('noimg');this.remove()">`}<span class="play">${play}</span><span class="src">${yt ? 'YouTube' : 'Instagram'}</span></span><span class="ref-label">Watch ref ${j + 1}${yt ? ' (YouTube)' : ''} ${ext}</span></a>`;
      }).join('');
      const cap = (capt && p.kind !== 'BTS') ? `<div class="cap"><b>Caption</b> ${mark(capt)}</div>` : '';
      const body = `<div class="d">${p.desc}</div>${p.tip ? `<div class="tip"><b>Tip</b>${p.tip}</div>` : ''}<div class="refs${p.idea ? ' is-idea' : ''}">${refs}</div>`;
      const head = `<div class="pc-top"><span class="num">${pad(i + 1)}</span><span class="k ${kindCls(p.kind)}">${p.kind}</span>${yours ? '<span class="yt">● Your team</span>' : ''}</div>`;
      if (full) return `<article class="pc${yours ? ' yours' : ''}" style="--i:${i}">${head}<h3>${p.title}</h3>${body}${cap}</article>`;
      return `<details class="pc" style="--i:${i}"><summary>${head}<h3>${p.title}</h3></summary>${body}</details>${cap ? `<div class="capx">${cap}</div>` : ''}`;
    }).join('');
    const rules = full ? `<p class="rules"><b>Video team:</b> music comes from Nate's approved playlist only, and every edit carries the Lighthouse / Armed and Dangerous'27 look. Teams split their pieces among themselves.</p>` : '';
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

  let active = -1, typed = '', typedAt = 0;
  const isOpen = () => !pop.hidden;
  function syncPick() {
    $('who-label').textContent = me || 'Pick your name'; pick.classList.toggle('empty', !me);
    opts.forEach(o => o.setAttribute('aria-selected', o.dataset.value === me));
  }
  function setActive(i, scroll) {
    active = i; opts.forEach((o, j) => o.classList.toggle('active', j === i));
    const o = opts[i]; if (!o) return;
    list.setAttribute('aria-activedescendant', o.id); if (scroll) o.scrollIntoView({ block: 'nearest' });
  }
  function openPick() {
    pop.hidden = false; back.hidden = false; pick.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('picking'); typed = '';
    setActive(Math.max(0, opts.findIndex(o => o.dataset.value === me)), true); list.focus({ preventScroll: true });
  }
  function closePick(refocus) {
    if (!isOpen()) return;
    pop.hidden = true; back.hidden = true; pick.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('picking'); if (refocus) pick.focus({ preventScroll: true });
  }
  function choose(v) {
    closePick(true); if (v === me) return;
    me = v; try { localStorage.setItem('ad27-me', me); } catch (e) {}
    syncPick();
    const n = nextDuty(); if (n) { current = n.id; history.replaceState(null, '', '#' + n.id); }
    renderDuties(); swap(() => { renderTabs(); renderView(); });
  }
  pick.onclick = () => isOpen() ? closePick(true) : openPick();
  pick.onkeydown = e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openPick(); } };
  list.onclick = e => { const o = e.target.closest('[role="option"]'); if (o) choose(o.dataset.value); };
  list.onpointermove = e => { const i = opts.indexOf(e.target.closest('[role="option"]')); if (i >= 0 && i !== active) setActive(i, false); };
  list.onkeydown = e => {
    const last = opts.length - 1, k = e.key;
    if (k === 'ArrowDown') setActive(Math.min(active + 1, last), true);
    else if (k === 'ArrowUp') setActive(Math.max(active - 1, 0), true);
    else if (k === 'Home') setActive(0, true);
    else if (k === 'End') setActive(last, true);
    else if (k === 'Enter' || k === ' ') { if (opts[active]) choose(opts[active].dataset.value); }
    else if (k === 'Escape') closePick(true);
    else if (k === 'Tab') { closePick(true); return; }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now(); typed = (now - typedAt > 700 ? '' : typed) + k.toLowerCase(); typedAt = now;
      const i = opts.findIndex(o => o.dataset.value && o.textContent.toLowerCase().startsWith(typed)); if (i >= 0) setActive(i, true);
    } else return;
    e.preventDefault();
  };
  back.onclick = () => closePick(false);
  $('who-x').onclick = () => closePick(true);
  document.addEventListener('pointerdown', e => { if (isOpen() && !e.target.closest('#who-wrap')) closePick(false); });
  syncPick();
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (SESSIONS.find(s => s.id === h) && h !== current) { current = h; renderTabs(); renderView(); }
  });

  // Marquee: the page's own words, repeated.
  const words = ['Armed and Dangerous\'27', 'Pneumatikus: Distributions of the Spirit', 'Lighthouse Church', 'Video', 'Social media', 'Writers', 'Jul 15–18, 2027', 'Kaduna'];
  const run = words.map(w => `<span>${w}</span><i></i>`).join('');
  $('marquee').innerHTML = `<div>${run}</div><div>${run}</div>`;

  // Theme toggle
  $('theme').onclick = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('ad27-theme', root.dataset.theme); } catch (e) {}
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
