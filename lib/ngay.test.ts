/**
 * Test cho ngayGanNhatCoBai (issue #31) — man "Chon ngay nop bai".
 *
 * Diem chot: 3 ngay GAN NHAT THAT SU co bai, khong phai 3 ngay lien tiep truoc
 * hom nay. Lop tieng Anh khong giao bai moi ngay (nghi cuoi tuan, nghi le) nen
 * neu tinh sai thanh mocNgay - 1, mocNgay - 2, mocNgay - 3 se ra nhung ngay
 * KHONG co bai — dung nut se gap man rong.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ngayGanNhatCoBai } from './ngay.ts';

test('bo qua ngay khong co bai, lay dung 3 ngay gan nhat CO bai (co le/cuoi tuan xen giua)', () => {
  const dueDates = ['2026-08-28', '2026-08-31', '2026-09-01', '2026-09-04'];
  // Hom nay 2026-09-04. 2026-09-02, 09-03 khong co bai (nghi) nen KHONG duoc chon.
  assert.deepEqual(
    ngayGanNhatCoBai(dueDates, '2026-09-04'),
    ['2026-09-04', '2026-09-01', '2026-08-31']
  );
});

test('bo qua ngay TRONG TUONG LAI so voi mocNgay (bai giao truoc, han sau)', () => {
  const dueDates = ['2026-09-01', '2026-09-05', '2026-09-10'];
  assert.deepEqual(ngayGanNhatCoBai(dueDates, '2026-09-04'), ['2026-09-01']);
});

test('mot ngay nhieu bai (nhieu con / nhieu mon) chi tinh MOT lan', () => {
  const dueDates = ['2026-09-04', '2026-09-04', '2026-09-04', '2026-09-01'];
  assert.deepEqual(ngayGanNhatCoBai(dueDates, '2026-09-04'), ['2026-09-04', '2026-09-01']);
});

test('it hon 3 ngay co bai thi tra ve dung so ngay do, khong bao loi', () => {
  assert.deepEqual(ngayGanNhatCoBai(['2026-09-01'], '2026-09-04'), ['2026-09-01']);
  assert.deepEqual(ngayGanNhatCoBai([], '2026-09-04'), []);
});

test('gioi han so ket qua qua tham so limit', () => {
  const dueDates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];
  assert.deepEqual(ngayGanNhatCoBai(dueDates, '2026-09-04', 2), ['2026-09-04', '2026-09-03']);
});
