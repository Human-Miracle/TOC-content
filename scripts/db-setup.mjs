// Creates the tables and, on an empty database, loads the TOC'26 plan and publishes it.
// Runs before every build. Does nothing when no database is connected.
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { importSnapshot, publish } from '../lib/snapshot.mjs';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.log('db-setup: no DATABASE_URL, skipping. The site will show the built-in plan.');
  process.exit(0);
}

const root = new URL('..', import.meta.url);
const client = new pg.Client({ connectionString: url });
await client.connect();
const q = async (text, params) => (await client.query(text, params)).rows;

try {
  await client.query(await readFile(new URL('db/schema.sql', root), 'utf8'));
  await client.query('begin');
  // One setup at a time, in case two builds start together.
  await client.query('select pg_advisory_xact_lock(826026)');
  const [{ n }] = await q('select count(*)::int as n from events');
  if (n === 0) {
    const plan = JSON.parse(await readFile(new URL('content/seed.json', root), 'utf8'));
    const eventId = await importSnapshot(q, plan, { current: true });
    await publish(q, eventId, 'setup');
    console.log(`db-setup: loaded and published "${plan.event.name}".`);
  } else {
    console.log(`db-setup: tables ready, ${n} event(s) already present.`);
  }
  await client.query('commit');
} catch (err) {
  await client.query('rollback').catch(() => {});
  console.error('db-setup failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
