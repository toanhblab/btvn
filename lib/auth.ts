/**
 * Xac thuc bo me bang MOT ma PIN dung chung (PRD muc 4.5) — khong tai khoan,
 * khong email, khong mat khau.
 *
 * PIN chi de tranh con tu sua/xoa bai tap cua minh, khong nham bao mat manh
 * (PRD muc 4.5 ghi ro dieu nay). Du vay van hash PIN va gioi han so lan nhap
 * sai de con khong mo mo ra duoc (PRD muc 10).
 */

import { cookies } from 'next/headers';
import { queryOne } from './db';

const COOKIE = 'btvn_parent';
const SECRET = process.env.PIN_SECRET || 'dev-secret-doi-truoc-khi-deploy';

/* ---------------- Hash PIN ---------------- */

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const hashPin = (pin: string) => sha256(`${SECRET}:${pin}`);

export async function checkPin(pin: string): Promise<boolean> {
  const row = await queryOne<{ parent_pin_hash: string }>(
    `SELECT parent_pin_hash FROM families ORDER BY created_at ASC LIMIT 1`
  );
  if (!row) return false;
  return (await hashPin(pin)) === row.parent_pin_hash;
}

/* ---------------- Cookie phien ---------------- */

async function token(): Promise<string> {
  return sha256(`${SECRET}:parent-session`);
}

/**
 * @param remember  Bo me tu chon "Nho tren thiet bi nay".
 *   Mac dinh FALSE — PRD 4.5 noi khong duoc nho PIN tren iPad cua con vi day la
 *   may dung chung; nho o do thi PIN mat tac dung. Chi nho khi bo me chu dong tick.
 */
export async function signIn(remember: boolean): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, await token(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: remember ? 60 * 60 * 24 * 30 : undefined, // undefined = het khi dong trinh duyet
  });
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isParent(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === (await token());
}

/* ---------------- Chan mo PIN ---------------- */

const attempts = new Map<string, { count: number; until: number }>();
const MAX_TRIES = 5;
const LOCK_MS = 60_000;

export function isLocked(key: string): number {
  const a = attempts.get(key);
  if (a && a.until > Date.now()) return Math.ceil((a.until - Date.now()) / 1000);
  return 0;
}

export function recordFail(key: string): void {
  const a = attempts.get(key) ?? { count: 0, until: 0 };
  a.count += 1;
  if (a.count >= MAX_TRIES) { a.until = Date.now() + LOCK_MS; a.count = 0; }
  attempts.set(key, a);
}

export function recordSuccess(key: string): void {
  attempts.delete(key);
}
