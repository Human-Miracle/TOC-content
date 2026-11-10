// Round trip: seed file -> tables -> snapshot must give back the same plan.
// Needs a scratch Postgres: TEST_DATABASE_URL=postgres://... npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { buildSnapshot, importSnapshot, publish } from '../lib/snapshot.mjs';

const url = process.env.TEST_DATABASE_URL;
const root = new URL('..', import.meta.url);
const seed = JSON.parse(await readFile(new URL('content/seed.json', root), 'utf8'));

// Times come back from the database in UTC; compare instants, not spellings.
const norm = plan => JSON.parse(JSON.stringify(plan, (k, v) =>
  typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v).toISOString() : v));

test('seed file is complete', () => {
  assert.equal(seed.sessions.length, 8);
  assert.equal(seed.sessions.flatMap(s => s.pieces).length, 34);
  const refs = seed.sessions.flatMap(s => s.pieces).flatMap(p => p.refs);
  assert.equal(refs.length, 52);
  assert.equal(new Set(refs.map(r => r.url)).size, 37);
});

test('import then snapshot returns the seed plan', { skip: !url && 'TEST_DATABASE_URL not set' }, async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const q = async (t, p) => (await client.query(t, p)).rows;
  try {
    await client.query(await readFile(new URL('db/schema.sql', root), 'utf8'));
    await client.query('begin');
    const id = await importSnapshot(q, { ...seed, event: { ...seed.event, slug: 'roundtrip-test' } });
    const snap = await buildSnapshot(q, id);
    snap.event.slug = seed.event.slug;
    assert.deepEqual(norm(snap), norm(seed));
    const live = await publish(q, id, 'test');
    const [row] = await q('select snapshot from publications where event_id = $1', [id]);
    assert.deepEqual(row.snapshot, JSON.parse(JSON.stringify(live)));
  } finally {
    await client.query('rollback');
    await client.end();
  }
});
