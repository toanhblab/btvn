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
import { gopLenBanNhap, maBanNhapMoi, tachBanNhap, type BanNhap } from './banNhap.ts';
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
  // Chep mon / ghi chu / giong doc / thoi luong / co quay video
  assert.equal(kq[1].subject, x.subject);
  assert.equal(kq[1].note, x.note);
  assert.equal(kq[1].lang, x.lang);
  assert.equal(kq[1].durationStr, '24');
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
