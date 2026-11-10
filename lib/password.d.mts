export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, stored: string): Promise<boolean>;
export function newToken(): string;
export function hashToken(token: string): string;
export const MIN_PASSWORD: number;
export function cleanEmail(v: unknown): string;
export function validEmail(v: string): boolean;
