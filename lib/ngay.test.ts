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
import { execFileSync } from 'node:child_process';
import { ngayGanNhatCoBai, ngayNha } from './ngay.ts';

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

/**
 * ngayNha (issue #43) — ngay cua dong "Bố mẹ đã trừ ⭐" o cua hang cua con va
 * cua muc "Đã trừ gần đây" / "Đã xử lý gần đây" cua bo me.
 *
 * Cho de vo: chuoi nay duoc dung o HAM Vercel (TZ=UTC), khong phai o may dev
 * (+07), nen `new Date(iso).toLocaleDateString('vi-VN')` tran hien lan tru luc
 * 06:30 sang gio nha thanh ngay HOM TRUOC — va khong lo ra khi chay o may nay.
 * Vi the phep thu goi ngayNha trong mot tien trinh node co TZ khac han.
 */
function ngayNhaVoiTZ(tz: string, iso: string): string {
  const nguon = JSON.stringify(new URL('./ngay.ts', import.meta.url).href);
  return execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `const { ngayNha } = await import(${nguon});\n` +
      `process.stdout.write(ngayNha(${JSON.stringify(iso)}));`,
    ],
    { env: { ...process.env, TZ: tz }, encoding: 'utf8' }
  );
}

test('moc 23:30Z la ngay HOM SAU theo gio nha, du may chay o mui gio nao', () => {
  // 2026-09-08T23:30:00Z = 06:30 sang 9/9 gio nha: bo me tru ⭐ sang nay
  for (const tz of ['UTC', 'America/New_York', 'Asia/Ho_Chi_Minh', 'Pacific/Kiritimati']) {
    assert.equal(ngayNhaVoiTZ(tz, '2026-09-08T23:30:00Z'), '9/9/2026', `TZ=${tz}`);
  }
});

test('moc 17:00Z van la ngay hom sau; 16:59:59Z con la hom nay (ranh gioi +07)', () => {
  assert.equal(ngayNha('2026-09-08T17:00:00.000Z'), '9/9/2026');
  assert.equal(ngayNha('2026-09-08T16:59:59.999Z'), '8/9/2026');
});

test('khuon vi-VN: ngay/thang khong co so 0 dan dau, nam du bon so', () => {
  assert.equal(ngayNha('2026-01-05T03:00:00Z'), '5/1/2026');
  assert.equal(ngayNha('2026-12-31T20:00:00Z'), '1/1/2027', 'sang nam moi theo gio nha');
});
