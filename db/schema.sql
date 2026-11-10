-- TOC content plan CMS schema. Safe to run more than once.
-- Editors change the working tables. The public site only reads `publications`,
-- which holds a full snapshot of an event taken when someone presses Publish.

create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  short_name  text not null,
  name        text not null,
  title       text not null default 'Content Plan',
  dates_label text not null default '',
  place       text not null default '',
  theme       text not null default '',
  org         text not null default '',
  rules_label text not null default '',
  rules       text not null default '',
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Only one event is shown on the home page.
create unique index if not exists events_one_current on events (is_current) where is_current;

create table if not exists event_days (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references events(id) on delete cascade,
  label     text not null,
  ends_at   timestamptz not null,
  unique (event_id, label)
);

create table if not exists teams (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references events(id) on delete cascade,
  name      text not null,
  position  int  not null default 0,
  unique (event_id, name)
);

create table if not exists roles (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  name        text not null,
  short_name  text,
  -- Which kind of piece this role works on, if any.
  piece_kind  text check (piece_kind in ('Inside', 'Outside', 'BTS')),
  -- True when the duty runs the whole day, not one session.
  all_day     boolean not null default false,
  -- True when the people on this role write the captions for a session.
  is_caption  boolean not null default false,
  position    int not null default 0,
  unique (team_id, name)
);

create table if not exists people (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references events(id) on delete cascade,
  name      text not null,
  unique (event_id, name)
);

create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  slug        text not null,
  name        text not null,
  short_name  text not null,
  time_label  text not null default '',
  day_label   text not null default '',
  starts_at   timestamptz,
  ends_at     timestamptz,
  note        text,
  -- False for a session with no posting slot (shows "Pieces", not a post count).
  counts_posts boolean not null default true,
  position    int not null default 0,
  unique (event_id, slug)
);

-- The roster: who is on which role in which session.
create table if not exists assignments (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  role_id     uuid not null references roles(id) on delete cascade,
  person_id   uuid not null references people(id) on delete cascade,
  position    int not null default 0,
  unique (session_id, role_id, person_id)
);

create table if not exists pieces (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  kind         text not null check (kind in ('Inside', 'Outside', 'BTS')),
  title        text not null,
  description  text not null default '',
  bullets      text[] not null default '{}',
  tip          text,
  is_idea      boolean not null default false,
  position     int not null default 0
);

create table if not exists refs (
  id         uuid primary key default gen_random_uuid(),
  piece_id   uuid not null references pieces(id) on delete cascade,
  url        text not null,
  thumb_url  text,
  position   int not null default 0
);

create table if not exists publications (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  snapshot      jsonb not null,
  published_at  timestamptz not null default now(),
  published_by  text
);
create index if not exists publications_latest on publications (event_id, published_at desc);
