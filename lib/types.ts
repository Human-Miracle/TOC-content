export type Kind = 'Inside' | 'Outside' | 'BTS';

export type Role = { role: string; short: string | null; kind: Kind | null; daily: boolean; caption: boolean; people: string[] };
export type Team = { team: string; roles: Role[] };
export type Ref = { url: string; thumb: string | null };
export type Piece = { kind: Kind; title: string; desc: string; bullets: string[]; tip: string | null; idea: boolean; refs: Ref[] };
export type Session = {
  id: string; name: string; short: string; time: string; day: string;
  start: string | null; end: string | null; note: string | null; countsPosts: boolean;
  teams: Team[]; pieces: Piece[];
};
export type EventInfo = {
  slug: string; shortName: string; name: string; title: string; dates: string; place: string;
  theme: string; org: string; rulesLabel: string; rules: string;
};
/** The published snapshot the public page renders. */
export type Plan = { event: EventInfo; teams: string[]; dayEnds: Record<string, string>; sessions: Session[] };
