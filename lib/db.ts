import 'server-only';
import pg from 'pg';

// One pool per server instance. Vercel's Neon integration sets DATABASE_URL (pooled).
const g = globalThis as unknown as { __tocPool?: pg.Pool };

export const hasDb = () => !!process.env.DATABASE_URL;

export function pool(): pg.Pool {
  if (!g.__tocPool) g.__tocPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  return g.__tocPool;
}

export async function q<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  return (await pool().query(text, params)).rows as T[];
}
