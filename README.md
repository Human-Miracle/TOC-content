# TOC Content Plan

The content plan site for The Outpouring Camp (Video, Social media, Writers), with a CMS in progress.

## How it works

- **Public page** (`/`): shows the latest *published* plan of the current event.
- **Database** (Postgres on Neon): editors change the working tables. Pressing Publish saves a full snapshot of the event into `publications`. The public page reads only that snapshot, so unfinished edits never show.
- **No database connected:** the site shows the built-in TOC'26 plan from `content/seed.json`. The same happens if the database cannot be reached, so the public page stays up.

## CMS build status

1. Foundation (this step): Next.js, tables, import of the TOC'26 plan, public page reading the published snapshot. **Done.**
2. Admin at `/admin`: sign-in, People, Sessions and days, Teams and roles, Roster, Editors, Publish. **Done.**
3. Pieces and references with automatic thumbnails. To do.
4. Event settings, more than one event in the admin, change log, restore. To do.

## Connect the database (once)

1. In Vercel, open the project, then **Storage → Create Database → Neon**. Pick the free plan and connect it to this project for Production and Preview.
2. Redeploy. The build creates the tables, loads the TOC'26 plan and publishes it.

Vercel adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to the project. Nothing needs to be copied by hand.

## Admin sign-in

- **First owner:** while nobody has an account, every build prints a one-time setup link in the Vercel build log (`/admin/join?token=...`). Open it, create the owner account. The link works once and lasts 7 days.
- **More editors:** an owner opens Admin → Editors and creates a one-time join link for an email. That person chooses their own password.
- **How it is protected:** passwords are hashed with scrypt, sign-in cookies are httpOnly and only their hash is stored, 8 wrong passwords lock an email for 15 minutes, and every save checks the signed-in user on the server.
- **Publishing:** edits are saved as you go. The public page changes only when someone presses Publish on the Overview.

## Folder map

- `app/`: pages and `globals.css` (the design).
- `components/PlanView.tsx`: name picker, duties, session tabs, piece cards.
- `lib/snapshot.mjs`: tables to snapshot, snapshot to tables, publish.
- `app/admin/`: admin screens and `actions.ts` (every save).
- `lib/auth.ts`, `lib/password.mjs`: sign-in, sessions, join links.
- `lib/plan.ts`: loads the live plan, with the built-in fallback.
- `db/schema.sql`: tables. Safe to run more than once.
- `scripts/db-setup.mjs`: runs before every build. Creates tables and seeds an empty database.
- `content/seed.json`: the TOC'26 plan.
- `public/refs/`: reference thumbnails.
- `tests/`: seed and round-trip tests.

## Commands

```bash
npm run dev
```

```bash
npm run build
```

```bash
TEST_DATABASE_URL=postgres://... npm test
```

The round-trip test needs a scratch Postgres. It rolls back everything it writes.
