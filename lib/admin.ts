import 'server-only';
import { q } from './db';
import { buildSnapshot } from './snapshot.mjs';

export type AdminEvent = { id: string; slug: string; name: string; short_name: string; timezone: string };

/** The event the admin edits. For now this is the event shown on the home page. */
export async function getAdminEvent(): Promise<AdminEvent | null> {
  const rows = await q<AdminEvent>('select id, slug, name, short_name, timezone from events where is_current limit 1');
  return rows[0] ?? null;
}

export type PublishState = { changed: boolean; publishedAt: Date | null; publishedBy: string | null };

/** Whether the working tables differ from what the public page shows. */
export async function publishState(eventId: string): Promise<PublishState> {
  const [last] = await q<{ snapshot: unknown; published_at: Date; published_by: string | null }>(
    'select snapshot, published_at, published_by from publications where event_id = $1 order by published_at desc limit 1', [eventId]);
  if (!last) return { changed: true, publishedAt: null, publishedBy: null };
  const draft = await buildSnapshot(q, eventId);
  // Compare through the same JSON round trip the database applies.
  const changed = canon(draft) !== canon(last.snapshot);
  return { changed, publishedAt: last.published_at, publishedBy: last.published_by };
}

// Stable text form: object keys sorted, so key order never counts as a change.
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val);
}
