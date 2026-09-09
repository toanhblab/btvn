/**
 * Bai kiem cho CHINH phep quet chu Viet (scripts/quet-chu-viet.mjs).
 *
 * Hop dong cua `kiemTep`: nhan NOI DUNG mot tep + duong dan, tra ve danh sach cau
 * tieng Viet chua qua `T(...)`. O day goi no bang chuoi dung san, khong doc dia —
 * tep that cua du an khong phai la du lieu cua bai kiem nay.
 *
 * Vi sao dang co: phep quet tung xoa MOI literal trung mot khoa dich, du no co
 * nam trong `T(...)` hay khong. Nen mot cau DA CO trong tu dien ma dung THO —
 * `setError('Mã PIN không đúng.')`, quen `T` — vua bien dich duoc, vua qua duoc
 * phep quet, vua hien chu Viet giua man tieng Nhat. Do la duong lot de xay ra
 * nhat, va phep quet nay la chot duy nhat gac tieu chi "khong mot chu Viet nao
 * lot ra" cua issue #46.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { kiemTep } = await import('../scripts/quet-chu-viet.mjs');

test('bao khoa dich dung THO (quen boc T) trong bien roi ve ra JSX', () => {
  const lot = kiemTep(
    `export default function X() {
       const loi = 'Mã PIN không đúng.';
       return <p>{loi}</p>;
     }`,
    'app/x.tsx'
  );
  assert.equal(lot.length, 1, `phai bao dung mot cau: ${JSON.stringify(lot)}`);
  assert.match(lot[0], /Mã PIN không đúng/);
});

test('KHONG bao khi cau da boc T(...)', () => {
  const lot = kiemTep(
    `export default function X({ T }) {
       return <p>{T('Mã PIN không đúng.')}</p>;
     }`,
    'app/x.tsx'
  );
  assert.deepEqual(lot, []);
});

test('KHONG bao bang khai bao khoa co kieu Key', () => {
  const lot = kiemTep(
    `import type { Key } from '@/lib/i18n/chu';
     export const TABS: { label: Key }[] = [{ label: 'Trang chủ' }];`,
    'app/tabs.ts'
  );
  assert.deepEqual(lot, []);
});

test('van bao khi cung tep co bang khoa nhung cho khac dung tho', () => {
  const lot = kiemTep(
    `import type { Key } from '@/lib/i18n/chu';
     export const TABS: { label: Key }[] = [{ label: 'Trang chủ' }];
     export function loi() { return 'Mã PIN không đúng.'; }`,
    'app/tabs.ts'
  );
  assert.equal(lot.length, 1, `bang khoa duoc mien, cau tho thi khong: ${JSON.stringify(lot)}`);
  assert.match(lot[0], /Mã PIN không đúng/);
});

test('bao chu tieng Viet KHONG DAU ve tran trong JSX', () => {
  const lot = kiemTep(`export default function X() { return <span>Quay xong</span>; }`, 'app/x.tsx');
  assert.equal(lot.length, 1, JSON.stringify(lot));
  assert.match(lot[0], /Quay xong/);
});

test('KHONG bao ten icon Material Symbols', () => {
  const lot = kiemTep(
    `export default function X() {
       return <span className="material-symbols-outlined">arrow_back</span>;
     }`,
    'app/x.tsx'
  );
  assert.deepEqual(lot, []);
});

/**
 * Hop dong "lib tra ve khoa, route dich" (chu thich dau lib/auth.ts): chi LIB moi
 * duoc tra khoa tho. Route quen `T` thi tra chu Viet xuong client, ma client hien
 * thang ra man (`setError(data.error)`), nen phai bi bao.
 */
test('bao error: khoa tho trong route cua app/**', () => {
  const lot = kiemTep(
    `import { NextResponse } from 'next/server';
     export async function GET() {
       return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });
     }`,
    'app/api/x/route.ts'
  );
  assert.equal(lot.length, 1, JSON.stringify(lot));
  assert.match(lot[0], /Cần mã PIN của bố mẹ/);
});

test('KHONG bao error: khoa tho trong lib/** (ham tra ve khoa, route moi dich)', () => {
  const lot = kiemTep(
    `export function f(): { error: Key } { return { error: 'Cần mã PIN của bố mẹ.' }; }`,
    'lib/store.ts'
  );
  assert.deepEqual(lot, []);
});

/**
 * Ten mon la khoa TRA CUU, khong phai chu ve ra man (ten luu DB la ban da dich —
 * xem subjectsFor / tenMonTheoNha). Nen chi mien o dong noi ve mon hoc.
 */
test('bao ten mon gan vao bien roi ve ra JSX', () => {
  const lot = kiemTep(
    `export default function X() { const nhan = 'Toán'; return <p>{nhan}</p>; }`,
    'app/y.tsx'
  );
  assert.equal(lot.length, 1, JSON.stringify(lot));
  assert.match(lot[0], /Toán/);
});

test('KHONG bao ten mon o vi tri tra cuu', () => {
  const lot = kiemTep(
    `const mau = SUBJECTS['Toán'];
     const icon = iconFor(d.subject ?? 'Khác');
     export const VIEC_NHA_SUBJECT = 'Việc nhà';`,
    'app/y.tsx'
  );
  assert.deepEqual(lot, []);
});

/**
 * Mot cau `const … Key …` thieu dau cham phay (ASI) khong duoc phep nuot phan con
 * lai cua tep roi mien tru moi khoa dung tho trong do.
 */
test('cau const thieu cham phay khong nuot phan sau cua tep', () => {
  const lot = kiemTep(
    `const A: Key = 'Trang chủ'
export function loi() { return 'Mã PIN không đúng.'; }
const b = 1;`,
    'app/z.tsx'
  );
  assert.equal(lot.length, 1, JSON.stringify(lot));
  assert.match(lot[0], /Mã PIN không đúng/);
});

/**
 * Mien tru "bang khai bao khoa" chi duoc ap cho BANG, khong cho THAN HAM. Truoc
 * day mot cau `const f = (k: Key) => { … }` duoc mien tru ca than ham, nen them
 * mot cau tieng Viet tho vao bat ky helper nao co `Key` trong chu ky la lot im
 * lang (repo dang co dung mot ham nhu vay: `tenMonTheoNha` o lib/ai.ts).
 */
test('bao khoa tho trong than ham co Key o chu ky', () => {
  const lot = kiemTep(
    `import type { Key } from '@/lib/i18n/chu';
export const f = (k: Key) => {
  const loi = 'Mã PIN không đúng.';
  return loi;
};`,
    'app/h.tsx'
  );
  assert.equal(lot.length, 1, JSON.stringify(lot));
  assert.match(lot[0], /Mã PIN không đúng/);
});

test('KHONG bao ba dang bang khai bao khoa that', () => {
  const bang = [
    [`export const TEN_NGON_NGU: Record<NgonNgu, Key> = { vi: 'tiếng Việt' };`, 'lib/speech.ts'],
    [`export const THU = [
  'Chủ Nhật', 'Thứ Hai',
] as const satisfies readonly Key[];`, 'lib/ngay.ts'],
    [`export const LY_DO_TRU_TRONG = 'Con hỏi bố mẹ vì sao nhé' satisfies Key;`, 'lib/types.ts'],
    [`export const HW_SOURCES: Record<HwSource, { label: Key; icon: string }> = {
  other: { label: 'Khác', icon: '📚' },
};`, 'lib/types.ts'],
  ] as const;
  for (const [src, tep] of bang) {
    assert.deepEqual(kiemTep(src, tep), [], `${tep}: ${src.slice(0, 40)}`);
  }
});
