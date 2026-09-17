/**
 * "Gop voi bai tren" / "✂️ Tach bai nay" o man Kiem tra lai (issue #64) — phan
 * THUAN cua KiemTraLai.tsx, khong can DOM.
 *
 * Dieu quan trong nhat o day khong phai phep cat chuoi ma la DANH TINH cua the:
 * vi tri con tro song trong THE DOM (`selectionStart`), con danh sach ban nhap
 * song trong state. Hai ben chi khop nhau khi the DOM duoc tra theo MA cua ban
 * nhap. Tra theo chi so trong mang thi chi can mot lan gop la mot the DOM cu
 * (con giu con tro cu) doi sang phuc vu ban nhap KHAC — bam Tach se cat mot the
 * bo me chua he cham vao, o dung cho con tro cu cua the kia. Ca "gop roi tach"
 * duoi day mo phong dung canh do.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dinhTepVaoBanNhap, goTepKhoiBanNhap, gopLenBanNhap, maBanNhapMoi, tachBanNhap, viTriBanNhap,
  type BanNhap,
} from './banNhap.ts';
import type { AttachedMedia } from './types.ts';

const banNhap = (content: string, them: Partial<BanNhap> = {}): BanNhap => ({
  ma: maBanNhapMoi(),
  subject: 'Toán', icon: '🔢', content, note: 'Sách Poth Math', lang: 'vi',
  confidence: 1, media: [], durationStr: '10', requiresVideo: false,
  ...them,
});

const tep = (url: string, kind: AttachedMedia['kind'] = 'image'): AttachedMedia =>
  ({ url, name: `${url}.dat`, kind });

/** O de bai: con tro thuoc ve THE, tra theo ma ban nhap — dung nhu oDeBai trong man hinh. */
const conTroTheoMa = (ghi: Record<string, number>) => (ma: string) => ghi[ma] ?? null;

test('gop len: the con lai giu nguyen MA cua no, khong thua ke ma theo cho dung', () => {
  const [a, b, c] = [banNhap('Toán trang 41'), banNhap('Chép bài thơ'), banNhap('Đọc to bài 3')];
  const sau = gopLenBanNhap([a, b, c], 1);

  assert.deepEqual(sau.map((d) => d.ma), [a.ma, c.ma], 'AB giu ma cua A, C giu ma cua C');
  assert.equal(sau[0].content, 'Toán trang 41 Chép bài thơ');
  assert.equal(sau[1].content, c.content);
});

test('gop len: tep dinh kem lay hop khong trung URL, co quay video la HOAC cua hai the', () => {
  const a = banNhap('A', { media: [tep('u1')], requiresVideo: false });
  const b = banNhap('B', { media: [tep('u1'), tep('u2', 'video')], requiresVideo: true });
  const [gop] = gopLenBanNhap([a, b], 1);

  assert.deepEqual(gop.media?.map((m) => m.url), ['u1', 'u2']);
  assert.equal(gop.requiresVideo, true);
});

test('gop len: GHI CHU giu ca hai the — do la ten sach + so trang con phai lay ra', () => {
  const ghiChu = (a: string | null, b: string | null) =>
    gopLenBanNhap([banNhap('A', { note: a }), banNhap('B', { note: b })], 1)[0].note;

  assert.equal(
    ghiChu('Poth Math — trang 41, 42, 43', 'Vở ô ly — trang 5'),
    'Poth Math — trang 41, 42, 43 · Vở ô ly — trang 5',
    'hai cuon khac nhau: giu ca hai, khong bo cuon cua the duoi');
  assert.equal(ghiChu('Poth Math — trang 41', null), 'Poth Math — trang 41');
  assert.equal(ghiChu(null, 'Vở ô ly — trang 5'), 'Vở ô ly — trang 5');
  assert.equal(ghiChu(null, null), null);
  assert.equal(ghiChu('   ', null), null, 'ghi chu chi co khoang trang = khong co');
  assert.equal(ghiChu('Vở ô ly', 'Vở ô ly'), 'Vở ô ly', 'cung mot cuon thi khong nhac hai lan');
});

test('gop len: thoi luong CONG hai the, kep tran 180 cua o nhap, khong thap hon so bo me da go', () => {
  const gop = (a: string, b: string) =>
    gopLenBanNhap([banNhap('A', { durationStr: a }), banNhap('B', { durationStr: b })], 1)[0].durationStr;

  assert.equal(gop('24', '8'), '32', 'the om viec cua ca hai thi dong ho phai du gio cho ca hai');
  assert.equal(gop('45', '30'), '75', 'so bo me go di theo tran 180 cua o nhap, khong phai tran 60 cua AI');
  assert.equal(gop('120', '90'), '180', 'kep o tran cua chinh o nhap');
  // O de trong / so hong = mac dinh 10, nhu luc luu
  assert.equal(gop('', '8'), '18');
  assert.equal(gop('24', ''), '34');
  assert.equal(gop('100', '8'), '108');
  // Ban nhap cu mang so tren ca tran: gop khong duoc HA THAP hon so dang co
  assert.equal(gop('200', '8'), '200');
});

test('gop roi tach: con tro cu cua the da gop KHONG cat nham the dung o cho cua no', () => {
  const [a, b, c] = [banNhap('Toán trang 41'), banNhap('Chép bài thơ'), banNhap('Đọc to bài 3')];
  // Bo me cham vao o de bai cua B (vi tri 5) roi bam "Gop voi bai tren" cho B
  const conTro = conTroTheoMa({ [b.ma]: 5 });
  const sau = gopLenBanNhap([a, b, c], 1);

  // Cho so 1 bay gio la C — the DOM cua no chua tung duoc cham vao
  const the = sau[1];
  assert.equal(the.ma, c.ma);
  const ketQua = tachBanNhap(sau, 1, conTro(the.ma));
  assert.equal(ketQua[1].content, c.content, 'de bai cua C con nguyen');
  assert.equal(ketQua[2].content, '', 'the moi de trong cho bo me go');

  // Doc con tro theo CHO (chi so 1, vi tri 5 con lai tu B) thi C bi cat lam doi
  const neuTheoChiSo = tachBanNhap(sau, 1, 5);
  assert.notEqual(neuTheoChiSo[1].content, c.content, 'de bai cua C bi cat cut');
  assert.notEqual(neuTheoChiSo[2].content, '', 'nua sau roi sang mot the bo me khong xin');
});

test('tach tai con tro: hai nua chia dung cho, the moi mang ma moi va khong om tep', () => {
  const x = banNhap('Toán trang 41 và chép bài thơ', {
    media: [tep('u1')], requiresVideo: true, durationStr: '24',
  });
  const kq = tachBanNhap([x], 0, 'Toán trang 41'.length);

  assert.deepEqual(kq.map((d) => d.content), ['Toán trang 41', 'và chép bài thơ']);
  assert.equal(kq[0].ma, x.ma);
  assert.notEqual(kq[1].ma, x.ma, 'the moi phai co ma rieng, khong dung chung o de bai');
  assert.deepEqual(kq[0].media, x.media, 'tep giu o the goc');
  assert.deepEqual(kq[1].media, []);
  // Chep mon / ghi chu / giong doc; thoi luong CHEP nguyen sang ca hai nua (sai
  // theo huong thua), khong chia ti le
  assert.equal(kq[1].subject, x.subject);
  assert.equal(kq[1].note, x.note);
  assert.equal(kq[1].lang, x.lang);
  assert.equal(kq[0].durationStr, '24');
  assert.equal(kq[1].durationStr, '24');
});

test('tach the co co video ma khong nua nao doi quay: giu co o nua DAU, nua sau bo co', () => {
  const x = banNhap('Toán trang 41 và chép bài thơ', { requiresVideo: true });
  const kq = tachBanNhap([x], 0, 'Toán trang 41'.length);

  assert.deepEqual(kq.map((d) => d.content), ['Toán trang 41', 'và chép bài thơ']);
  assert.equal(kq[0].requiresVideo, true, 'nua dau la phan o lai the cu');
  assert.equal(kq[1].requiresVideo, false, 'viec vua tach ra khong tu nhien doi quay video');

  // Cung the do, con tro o cuoi (khong cat thuc su): the moi trong thi khong co co
  const nguyen = tachBanNhap([x], 0, null);
  assert.equal(nguyen[0].requiresVideo, true);
  assert.equal(nguyen[1].requiresVideo, false);
});

test('tach the gop vi mot nua phai quay video: co theo dung nua mang chu "đọc to"', () => {
  const x = banNhap('Poth Math trang 41, 42. Poth Math bài 3: đọc to cho cô nghe', {
    requiresVideo: true, durationStr: '24',
  });
  const kq = tachBanNhap([x], 0, 'Poth Math trang 41, 42.'.length);

  assert.deepEqual(kq.map((d) => d.content),
    ['Poth Math trang 41, 42.', 'Poth Math bài 3: đọc to cho cô nghe']);
  assert.equal(kq[0].requiresVideo, false, 'nua trang giay het co — khong thi con mat nut "Đã làm xong"');
  assert.equal(kq[1].requiresVideo, true, 'nua "đọc to" van phai quay');
  assert.equal(kq[0].durationStr, '24', 'thoi luong van chep sang ca hai nua');
  assert.equal(kq[1].durationStr, '24');
});

test('tach the CHUA bat co ma mot nua doi quay: nua do duoc bat co', () => {
  const x = banNhap('Viết chính tả vào vở. Đọc thuộc lòng bài thơ cho cô nghe');
  const kq = tachBanNhap([x], 0, 'Viết chính tả vào vở.'.length);

  assert.equal(kq[0].requiresVideo, false);
  assert.equal(kq[1].requiresVideo, true);
});

test('tach khi khong biet con tro (chua cham vao o) hay con tro o dau/cuoi: the moi de trong', () => {
  const x = banNhap('Toán trang 41');
  for (const viTri of [null, 0, x.content.length]) {
    const kq = tachBanNhap([x], 0, viTri);
    assert.equal(kq[0].content, x.content, `vi tri ${viTri}`);
    assert.equal(kq[1].content, '', `vi tri ${viTri}`);
  }
});

test('tep dinh vao the nao thi o lai the do, du trong luc tai len bo me tach / gop the khac', () => {
  const [a, b, c] = [banNhap('A'), banNhap('B'), banNhap('C')];
  // Bo me bam dinh tep o the C (cho so 2) roi trong luc doi tai len, tach the A
  const maDangTai = c.ma;
  const sauTach = tachBanNhap([a, b, c], 0, null);      // chen mot the moi -> C trot xuong cho 3
  assert.equal(viTriBanNhap(sauTach, maDangTai), 3);

  const xong = dinhTepVaoBanNhap(sauTach, maDangTai, tep('u1'));
  assert.deepEqual(xong.find((d) => d.ma === maDangTai)?.media, [tep('u1')]);
  assert.deepEqual(
    xong.filter((d) => d.ma !== maDangTai).flatMap((d) => d.media ?? []), [],
    'khong bai nao khac om tep');

  // Chieu gop cung vay: the bien mat khoi cho cu ma tep van ve dung the
  const sauGop = gopLenBanNhap([a, b, c], 1);           // [AB, C] -> C len cho 1
  assert.equal(viTriBanNhap(sauGop, maDangTai), 1);
  assert.deepEqual(
    dinhTepVaoBanNhap(sauGop, maDangTai, tep('u2')).find((d) => d.ma === maDangTai)?.media,
    [tep('u2')]);
});

test('the da bi xoa trong luc tai len: tep bi bo, khong dinh nham the khac', () => {
  const [a, b] = [banNhap('A'), banNhap('B')];
  const conLai = [a];   // bo me xoa the B trong luc doi

  const xong = dinhTepVaoBanNhap(conLai, b.ma, tep('u1'));
  assert.deepEqual(xong.flatMap((d) => d.media ?? []), []);
});

test('go tep cung tra theo ma: go dung tep cua dung the', () => {
  const a = banNhap('A', { media: [tep('u1'), tep('u2')] });
  const b = banNhap('B', { media: [tep('u1')] });

  const sau = goTepKhoiBanNhap([a, b], a.ma, 'u1');
  assert.deepEqual(sau[0].media?.map((m) => m.url), ['u2']);
  assert.deepEqual(sau[1].media?.map((m) => m.url), ['u1'], 'the kia con nguyen');
});
