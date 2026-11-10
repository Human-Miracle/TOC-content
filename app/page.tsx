import type { Metadata } from 'next';
import PlanView from '@/components/PlanView';
import ThemeToggle from '@/components/HeroChrome';
import { getLivePlan } from '@/lib/plan';

// Re-read the published plan at most once a minute. Publishing will refresh it at once.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { plan: { event, teams } } = await getLivePlan();
  const title = `${event.shortName} ${event.title}`;
  const sub = [...teams, event.dates, event.place].filter(Boolean).join(' · ');
  return { title, description: `${event.name} ${event.title.toLowerCase()}. ${sub}.`, openGraph: { title, description: sub } };
}

export default async function Home() {
  const { plan } = await getLivePlan();
  const { event, teams } = plan;
  // Last word of the title is set in the italic serif.
  const words = event.title.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop()! : '';
  const marquee = [event.name, event.theme, event.org, ...teams, event.dates, event.place].filter(Boolean);
  const run = marquee.map((w, i) => <span key={i} className="mq-item"><span>{w}</span><i /></span>);

  return (
    <>
      <a className="skip" href="#plan">Skip to the plan</a>
      <header className="hero" id="top">
        <div className="hero-bg" aria-hidden="true">
          <svg className="ring" viewBox="0 0 400 400">
            <circle cx="200" cy="200" r="150" pathLength={400} strokeDasharray="88 12" strokeDashoffset={44} />
            <circle className="ring-thin" cx="200" cy="200" r="194" pathLength={400} strokeDasharray="1 3" />
          </svg>
        </div>
        <div className="shell hero-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/logo.png" width={1324} height={378} alt={event.name} />
          <div className="hero-actions">
            <span className="pill-meta">{[event.dates, event.place].filter(Boolean).join(' · ')}</span>
            <ThemeToggle />
          </div>
        </div>
        <div className="shell hero-title">
          <h1 aria-label={event.title}>
            <span className="line" aria-hidden="true"><span className="word">{words.join(' ')}</span></span>
            {last && <span className="line line-2" aria-hidden="true"><span className="word"><em>{last}</em></span></span>}
          </h1>
        </div>
        <div className="shell hero-meta">
          <div><span>Teams</span>{teams.join(' · ')}</div>
          <div><span>Dates</span>{event.dates}</div>
          <div><span>Place</span>{event.place}</div>
          <div><span>Theme</span>{event.theme}</div>
        </div>
        <div className="marquee" aria-hidden="true"><div className="marquee-track"><div>{run}</div><div>{run}</div></div></div>
      </header>

      <PlanView plan={plan} />

      <footer className="foot">
        <div className="shell foot-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/logo.png" width={1324} height={378} alt="" loading="lazy" />
          <p>{[event.name, event.theme, event.org].filter(Boolean).join(' · ')}</p>
          <a className="totop" href="#top">Back to top <span aria-hidden="true">↑</span></a>
        </div>
      </footer>
    </>
  );
}
