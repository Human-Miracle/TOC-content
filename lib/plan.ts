import 'server-only';
import seed from '@/content/seed.json';
import { hasDb, q } from './db';
import type { Plan } from './types';

export type PlanResult = { plan: Plan; source: 'database' | 'built-in' };

/**
 * The live plan: the latest published snapshot of the current event.
 * Without a database (or if it cannot be reached) the built-in TOC'26 plan is shown,
 * so the public page never goes down with the database.
 */
export async function getLivePlan(): Promise<PlanResult> {
  if (hasDb()) {
    try {
      const rows = await q<{ snapshot: Plan }>(
        `select p.snapshot from publications p join events e on e.id = p.event_id
          where e.is_current order by p.published_at desc limit 1`);
      if (rows[0]) return { plan: rows[0].snapshot, source: 'database' };
      console.warn('plan: no published event yet, showing the built-in plan');
    } catch (err) {
      console.error('plan: database read failed, showing the built-in plan:', (err as Error).message);
    }
  }
  return { plan: seed as Plan, source: 'built-in' };
}
