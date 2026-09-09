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
