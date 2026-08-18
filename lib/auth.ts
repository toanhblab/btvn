/**
 * Xac thuc bo me bang MA PIN — khong tai khoan, khong email, khong mat khau.
 *
 * Nhieu gia dinh dung chung mot app (bo me chia se cho ban be), va ma PIN vua la
 * MAT KHAU vua la DANH TINH cua nha: nhap PIN -> tra ra dung mot nha. Vi vay hai
 * nha khong duoc trung PIN (unique index families_pin_idx, xem migrations/).
 *
 * PIN chi de tranh con tu sua/xoa bai tap va tranh nham nha, khong nham bao mat
 * manh (PRD muc 4.5 ghi ro dieu nay). Du vay van hash PIN va gioi han so lan
 * nhap sai de con khong mo mo ra duoc (PRD muc 10).
 *
 * Hai cookie, hai viec khac nhau:
 *
 *   btvn_parent  Phien cua bo me — mo duoc /bome, them/sua/xoa bai. Mac dinh het
 *                khi dong trinh duyet.
 *   btvn_nha     "May nay la cua nha nao" — CHI de man cua con biet phai hien
 *                danh sach con nao, khong mo duoc gi cua bo me. Song mot nam vi
 *                iPad cua cac con phai mo len la chay, khong dang nhap (PRD 4.5).
 */

import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { PIN_LEN } from './pin';
import {
  findFamilyByPinHash,
  insertFamily,
  pinHashTaken,
  updateFamilyPinHash,
  type Family,
} from './store';

const PARENT_COOKIE = 'btvn_parent';
export const DEVICE_COOKIE = 'btvn_nha';
const SECRET = process.env.PIN_SECRET || 'dev-secret-doi-truoc-khi-deploy';

export { PIN_LEN };

/** PIN phai la dung 4 chu so — ban phim o man nhap chi co so nen day la chot cuoi. */
export const pinOk = (pin: string) => new RegExp(`^\\d{${PIN_LEN}}$`).test(pin);

/* ---------------- Hash PIN ---------------- */

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const hashPin = (pin: string) => sha256(`${SECRET}:${pin}`);

/** Nha nao dung ma PIN nay. null = khong nha nao. */
export async function findFamilyByPin(pin: string): Promise<Family | null> {
  if (!pinOk(pin)) return null;
  return findFamilyByPinHash(await hashPin(pin));
}

/* ---------------- Cookie co chu ky ----------------
 *
 * Cookie phai chua familyId de biet dang la nha nao, nhung familyId de doan
 * khong duoc — sua cookie thanh id nha khac la xem duoc du lieu nha do. Nen dinh
 * kem chu ky tinh tu PIN_SECRET; khong co secret thi khong ky duoc.
 */

async function sign(value: string): Promise<string> {
  return (await sha256(`${SECRET}:sig:${value}`)).slice(0, 32);
}

async function seal(familyId: string): Promise<string> {
  return `${familyId}.${await sign(familyId)}`;
}

async function unseal(raw: string | undefined): Promise<string | null> {
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  return (await sign(id)) === raw.slice(dot + 1) ? id : null;
}

const baseOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

const DEVICE_MAX_AGE = 60 * 60 * 24 * 365;

/* ---------------- Phien cua bo me ---------------- */

/**
 * @param remember  Bo me tu chon "Nho tren thiet bi nay".
 *   Mac dinh FALSE — PRD 4.5 noi khong duoc nho PIN tren iPad cua con vi day la
 *   may dung chung; nho o do thi PIN mat tac dung. Chi nho khi bo me chu dong tick.
 *
 * Dat luon cookie thiet bi: bo me vua nhap PIN thi may nay ro rang la cua nha do,
 * nho vay bam "Man hinh cua con" la xem duoc ngay.
 */
export async function signIn(familyId: string, remember: boolean): Promise<void> {
  const jar = await cookies();
  const value = await seal(familyId);
  jar.set(PARENT_COOKIE, value, {
    ...baseOpts,
    maxAge: remember ? 60 * 60 * 24 * 30 : undefined, // undefined = het khi dong trinh duyet
  });
  jar.set(DEVICE_COOKIE, value, { ...baseOpts, maxAge: DEVICE_MAX_AGE });
}

/**
 * Quen PIN tren thiet bi nay.
 *
 * KHONG xoa cookie thiet bi: dung nhat cua nut nay la bo me trot tick "nho" tren
 * iPad cua cac con: phai dong phan bo me lai, nhung man cua con thi van phai mo
 * len la chay.
 */
export async function signOut(): Promise<void> {
  (await cookies()).delete(PARENT_COOKIE);
}

/** Nha cua phien bo me hien tai. null = chua nhap PIN. */
export async function parentFamilyId(): Promise<string | null> {
  return unseal((await cookies()).get(PARENT_COOKIE)?.value);
}

export async function isParent(): Promise<boolean> {
  return (await parentFamilyId()) !== null;
}

/* ---------------- Nha gan voi thiet bi ---------------- */

export async function deviceFamilyId(): Promise<string | null> {
  return unseal((await cookies()).get(DEVICE_COOKIE)?.value);
}

/** Gan thiet bi nay vao mot nha (goi trong route handler). */
export async function setDeviceFamily(familyId: string): Promise<void> {
  (await cookies()).set(DEVICE_COOKIE, await seal(familyId), {
    ...baseOpts,
    maxAge: DEVICE_MAX_AGE,
  });
}

/** Gan thiet bi khi tra ve mot response da tao san (vi du redirect). */
export async function attachDeviceFamily(res: NextResponse, familyId: string): Promise<void> {
  res.cookies.set(DEVICE_COOKIE, await seal(familyId), { ...baseOpts, maxAge: DEVICE_MAX_AGE });
}

/**
 * Nha dang xem o man cua con.
 *
 * Uu tien phien bo me: bo me dang mo /con de xem thu tren dien thoai cua minh
 * thi phai thay dung nha minh, ke ca khi may do tung duoc gan vao nha khac.
 */
export async function viewingFamilyId(): Promise<string | null> {
  return (await parentFamilyId()) ?? (await deviceFamilyId());
}

/* ---------------- Tao nha / doi PIN ---------------- */

export type CreateResult =
  | { ok: true; family: Family }
  | { ok: false; error: string };

export async function createFamily(name: string, pin: string): Promise<CreateResult> {
  if (!pinOk(pin)) return { ok: false, error: `Mã PIN phải là ${PIN_LEN} chữ số.` };
  const hash = await hashPin(pin);
  if (await pinHashTaken(hash)) {
    return { ok: false, error: 'Mã PIN này có nhà khác dùng rồi, chọn mã khác nhé.' };
  }
  return { ok: true, family: await insertFamily(name, hash) };
}

export async function changePin(
  familyId: string,
  oldPin: string,
  newPin: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await findFamilyByPin(oldPin);
  if (!current || current.id !== familyId) {
    return { ok: false, error: 'Mã PIN cũ không đúng.' };
  }
  if (!pinOk(newPin)) return { ok: false, error: `Mã PIN mới phải là ${PIN_LEN} chữ số.` };

  const hash = await hashPin(newPin);
  if (await pinHashTaken(hash, familyId)) {
    return { ok: false, error: 'Mã PIN này có nhà khác dùng rồi, chọn mã khác nhé.' };
  }
  await updateFamilyPinHash(familyId, hash);
  return { ok: true };
}

/* ---------------- Chan mo PIN ----------------
 *
 * Dem trong RAM nen tren Vercel moi instance dem rieng — chan duoc tre ngoi mo
 * lien tuc, khong chan duoc may quet co to chuc. Voi khoang muoi nha va du lieu
 * khong co gi nhay cam thi chap nhan duoc (PRD muc 10).
 */

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

/**
 * Mot lan nhap PIN: kiem tra khoa, tra ve nha tuong ung, ghi nhan sai/dung.
 *
 * Dung chung cho ca hai duong nhap PIN (mo phan bo me, va gan iPad vao nha) de
 * hai duong khong the co gioi han khac nhau — bo qua mot duong la coi nhu khong
 * co gioi han nao.
 *
 * @param ipKey  Khoa dem, thuong la IP. Cung IP thi dung chung han muc.
 */
export async function attemptPin(
  pin: string,
  ipKey: string
): Promise<{ ok: true; family: Family } | { ok: false; status: number; error: string }> {
  const wait = isLocked(ipKey);
  if (wait > 0) {
    return { ok: false, status: 429, error: `Sai nhiều lần quá. Thử lại sau ${wait} giây.` };
  }

  const family = await findFamilyByPin(pin);
  if (!family) {
    recordFail(ipKey);
    return { ok: false, status: 401, error: 'Mã PIN không đúng.' };
  }

  recordSuccess(ipKey);
  return { ok: true, family };
}
