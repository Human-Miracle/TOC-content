import type { Plan } from './types';
type Q = (text: string, params?: unknown[]) => Promise<any[]>;
export function buildSnapshot(q: Q, eventId: string): Promise<Plan>;
export function publish(q: Q, eventId: string, by?: string | null): Promise<Plan>;
export function importSnapshot(q: Q, plan: Plan, opts?: { current?: boolean }): Promise<string>;
