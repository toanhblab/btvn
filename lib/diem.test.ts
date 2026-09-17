/**
 * Test luat tinh diem (lib/diem.ts) — ham thuan, khong DB. Phan SQL (unique
 * index "cong mot lan", so du, khong hoi to chay tren luoc do that) o
 * lib/tinh-diem.test.ts.
 *
 * Luat captain chot: +10 mot ngay xong het (ca bai tap lan viec nha), +1 moi
 * bai xong SOM hon thoi luong du kien cua chinh bai do ("5' de lam, xong trong
 * 4' thi duoc thuong"), khong hoi to truoc ngay ra mat.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIEM_NGAY_XONG, DIEM_XONG_SOM, TI_LE_TOI_THIEU_DE_XONG, giayConPhaiCho, locMocBatDau,
  ngayDuocTinhDiem, ngayHoanThanh, xepHang, xongSom,
} from './diem.ts';

const PHUT = 60_000;

test('hang so dung y captain: 10 diem/ngay xong, 1 diem/bai xong som', () => {
  assert.equal(DIEM_NGAY_XONG, 10);
  assert.equal(DIEM_XONG_SOM, 1);
});

/* ---- xong som ---- */

test('xong som: bai 5 phut lam trong 4 phut -> som (vi du cua captain)', () => {
  const batDau = 1_000_000;
  assert.equal(xongSom(batDau, batDau + 4 * PHUT, 5), true);
});

test('xong dung 5 phut cho bai 5 phut -> KHONG som (phai NHO HON thoi luong)', () => {
  const batDau = 1_000_000;
  assert.equal(xongSom(batDau, batDau + 5 * PHUT, 5), false);
});

test('qua gio -> khong som; khong bam "Bat dau lam" (null) -> khong som', () => {
  const batDau = 1_000_000;
  assert.equal(xongSom(batDau, batDau + 7 * PHUT, 5), false);
  assert.equal(xongSom(null, batDau + 1 * PHUT, 5), false, 'con lam ra giay roi vao tick thi khong co moc -> khong thuong');
});

test('moc bat dau o TUONG LAI so voi luc xong -> khong som (du lieu la, dong ho lech)', () => {
  const xong = 1_000_000;
  assert.equal(xongSom(xong + 10_000, xong, 5), false);
});

test('bam "Bat dau lam" roi tick ngay (1 giay) -> van som — gioi han da noi ro, khong chong', () => {
  const batDau = 1_000_000;
  assert.equal(xongSom(batDau, batDau + 1_000, 5), true);
});

/* ---- loc moc bat dau tu may con ---- */

test('locMocBatDau: nhan so hoac chuoi so; bo qua NaN, am, 0, tuong lai, thieu', () => {
  const now = 2_000_000;
  assert.equal(locMocBatDau(1_500_000, now), 1_500_000);
  assert.equal(locMocBatDau('1500000', now), 1_500_000);
  assert.equal(locMocBatDau(1_500_000.7, now), 1_500_000, 'lam tron xuong');
  assert.equal(locMocBatDau(now, now), now, 'dung bang now van nhan (elapsed 0)');
  assert.equal(locMocBatDau(now + 1, now), null, 'tuong lai -> bo');
  assert.equal(locMocBatDau(0, now), null);
  assert.equal(locMocBatDau(-5, now), null);
  assert.equal(locMocBatDau('abc', now), null);
  assert.equal(locMocBatDau('', now), null);
  assert.equal(locMocBatDau(undefined, now), null);
  assert.equal(locMocBatDau(null, now), null);
  assert.equal(locMocBatDau(NaN, now), null);
  assert.equal(locMocBatDau(Infinity, now), null);
});

/* ---- ngay hoan thanh ---- */

test('ngay hoan thanh: bai tap + viec nha deu done -> true', () => {
  assert.equal(
    ngayHoanThanh([
      { status: 'done', choreId: null },
      { status: 'done', choreId: null },
      { status: 'done', choreId: 'chr_1' },
      { status: 'done', choreId: 'chr_2' },
    ]),
    true
  );
});

test('ngay hoan thanh: het bai tap nhung con viec nha chua tick -> false (dung cong thuc sau #36)', () => {
  assert.equal(
    ngayHoanThanh([
      { status: 'done', choreId: null },
      { status: 'todo', choreId: 'chr_1' },
    ]),
    false
  );
});

test('ngay hoan thanh: chi co viec nha (khong co bai tap that) da tick het -> false', () => {
  assert.equal(
    ngayHoanThanh([
      { status: 'done', choreId: 'chr_1' },
      { status: 'done', choreId: 'chr_2' },
    ]),
    false,
    'bo me xoa het bai cua ngay do thi khong con la "lam xong bai tap"'
  );
});

test('ngay hoan thanh: khong co dong nao -> false', () => {
  assert.equal(ngayHoanThanh([]), false);
});

/* ---- khong hoi to ---- */

test('khong hoi to: ngay truoc score_since khong tinh, dung ngay va sau thi tinh', () => {
  const RA_MAT = '2026-09-08';
  assert.equal(ngayDuocTinhDiem('2026-09-07', RA_MAT), false, 'hom truoc ra mat: khong');
  assert.equal(ngayDuocTinhDiem('2026-09-08', RA_MAT), true, 'dung ngay ra mat: co');
  assert.equal(ngayDuocTinhDiem('2026-09-09', RA_MAT), true);
  assert.equal(ngayDuocTinhDiem('2025-12-31', RA_MAT), false, 'so sanh chuoi YYYY-MM-DD dung ca khi khac nam');
});

/* ---- xep hang ---- */

test('xep hang: cao nhat truoc, bang diem thi cung hang (1-2-2-4)', () => {
  const kq = xepHang([
    { id: 'a', points: 30 },
    { id: 'b', points: 50 },
    { id: 'c', points: 30 },
    { id: 'd', points: 0 },
  ]);
  assert.deepEqual(
    kq.map((x) => [x.id, x.rank]),
    [['b', 1], ['a', 2], ['c', 2], ['d', 4]]
  );
});

test('xep hang: bang diem giu nguyen thu tu dau vao (thu tu con trong nha), khong doi cho', () => {
  const kq = xepHang([{ id: 'minh', points: 0 }, { id: 'an', points: 0 }, { id: 'bena', points: 0 }]);
  assert.deepEqual(kq.map((x) => x.id), ['minh', 'an', 'bena']);
  assert.deepEqual(kq.map((x) => x.rank), [1, 1, 1]);
});

test('xep hang: khong sua mang dau vao', () => {
  const vao = [{ id: 'a', points: 1 }, { id: 'b', points: 2 }];
  xepHang(vao);
  assert.deepEqual(vao.map((x) => x.id), ['a', 'b']);
});

/* ---- hang rao 50% truoc khi duoc bam "Da lam xong" (issue #72) ---- */

test('hang rao la 50% thoi luong cua CHINH bai do', () => {
  assert.equal(TI_LE_TOI_THIEU_DE_XONG, 0.5);
});

test('bai 10 phut: bam xong ngay -> phai cho them 5 phut', () => {
  const batDau = 1_000_000;
  assert.equal(giayConPhaiCho(batDau, batDau, 10), 300);
  assert.equal(giayConPhaiCho(batDau, batDau + 2 * PHUT, 10), 180);
});

test('dung 50% la mo — bai 10 phut, phut thu 5', () => {
  const batDau = 1_000_000;
  assert.equal(giayConPhaiCho(batDau, batDau + 5 * PHUT - 1, 10), 1, 'thieu 1ms thi van khoa');
  assert.equal(giayConPhaiCho(batDau, batDau + 5 * PHUT, 10), 0);
});

test('qua 50% roi thi luon 0, ke ca qua gio', () => {
  const batDau = 1_000_000;
  assert.equal(giayConPhaiCho(batDau, batDau + 9 * PHUT, 10), 0);
  assert.equal(giayConPhaiCho(batDau, batDau + 99 * PHUT, 10), 0);
});

test('khong co moc bat dau -> 0: giu nguyen hanh vi cu (con chua bam Bat dau, dong nhiem vu hang ngay)', () => {
  assert.equal(giayConPhaiCho(null, 1_000_000, 10), 0);
});

test('cua so 50%-100% van la "xong som" -> luat +1 cu khong bi hang rao pha', () => {
  const batDau = 1_000_000;
  for (const phut of [5, 6, 7, 8, 9]) {
    const xong = batDau + phut * PHUT;
    assert.equal(giayConPhaiCho(batDau, xong, 10), 0, `phut ${phut}: phai bam duoc`);
    assert.equal(xongSom(batDau, xong, 10), true, `phut ${phut}: van tinh xong som`);
  }
  // Dung 10 phut thi bam duoc nhung het "som" — dung luat cu (xongSom o tren).
  assert.equal(giayConPhaiCho(batDau, batDau + 10 * PHUT, 10), 0);
  assert.equal(xongSom(batDau, batDau + 10 * PHUT, 10), false);
});

test('lam tron LEN theo giay: con 1.2s thi bao 2s, khong bao 1s roi van bi tu choi', () => {
  const batDau = 1_000_000;
  assert.equal(giayConPhaiCho(batDau, batDau + 5 * PHUT - 1_200, 10), 2);
});
