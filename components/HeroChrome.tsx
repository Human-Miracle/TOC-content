'use client';

import { useEffect } from 'react';

/** Theme switch button, plus the slow drift of the hero ring on scroll. */
export default function ThemeToggle() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ring = document.querySelector<SVGElement>('.ring'); if (!ring) return;
    let tick = false;
    const onScroll = () => {
      if (tick) return; tick = true;
      requestAnimationFrame(() => { ring.style.setProperty('--s', String(Math.min(scrollY, 1200))); tick = false; });
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('toc26-theme', root.dataset.theme); } catch {}
  };

  return (
    <button className="theme" type="button" aria-label="Switch theme" onClick={toggle}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M10 2.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" /></svg>
    </button>
  );
}
