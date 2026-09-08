/**
 * Test hoi quy cho loi "upload mp3 len khong co am thanh" (issue #7).
 *
 * Ca tai hien duoc tren ban chay that: mot tep audio/mpeg ma TEN khong co duoi
 * .mp3 (iPad/Zalo hay dua ten kieu do). Code cu khong gui contentType nen Vercel
 * Blob doan kieu tu ten tep -> "application/octet-stream" va tu choi thang:
 *
 *   Vercel Blob: Content type mismatch, "contentType" application/octet-stream
 *   is not allowed.
 *
 * Bo me khong de y dong chu do -> bam Luu -> bai khong co tep -> "khong thay co
 * am thanh". Voi duoi SAI loai thi tep len duoc nhung Blob dan nham kieu, ma
 * Blob tra kem x-content-type-options: nosniff nen trinh duyet khong doan lai,
 * <audio> im luon.
 *
 * Chot o day: uploadMediaFile / uploadSubmissionVideo phai bao kieu that
 * (file.type) cho Blob, dung de Blob doan tu ten tep.
 */

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

interface Ghi {
  pathname: string;
  options: { contentType?: string };
}

const daGoi: Ghi[] = [];

mock.module('@vercel/blob/client', {
  namedExports: {
    upload: async (pathname: string, _file: File, options: { contentType?: string }) => {
      daGoi.push({ pathname, options });
      return { url: `https://x.public.blob.vercel-storage.com/${pathname}` };
    },
  },
});

const { uploadMediaFile, uploadSubmissionVideo, mediaKindOf, driveFileIdTu, tenTepNop } =
  await import('./media.ts');

beforeEach(() => {
  daGoi.length = 0;
});

/** Tep nhu iPad dua sang: kieu that dung, ten thi khong co duoi. */
const tepKhongDuoi = (kieu: string) => new File([new Uint8Array([1, 2, 3])], 'ghi am co doc mau', { type: kieu });

test('tep dinh kem: bao kieu that cho Blob thay vi de Blob doan tu ten tep', async () => {
  await uploadMediaFile(tepKhongDuoi('audio/mpeg'), true);
  assert.equal(daGoi.length, 1);
  assert.equal(
    daGoi[0].options.contentType,
    'audio/mpeg',
    'thieu contentType -> Blob doan ra application/octet-stream va tu choi tep'
  );
});

test('tep dinh kem: kieu bao len dung la kieu cua tep, khong phai doan tu duoi', async () => {
  // Duoi .mp3 nhung ruot la m4a — neu de Blob doan theo ten thi no dan
  // audio/mpeg, sai kieu, va <audio> khong phat duoc.
  const tep = new File([new Uint8Array([1, 2, 3])], 'co-doc-mau.mp3', { type: 'audio/mp4' });
  await uploadMediaFile(tep, true);
  assert.equal(daGoi[0].options.contentType, 'audio/mp4');
});

test('video con nop: cung phai bao kieu that (con chon tep san tren iPad)', async () => {
  await uploadSubmissionVideo(tepKhongDuoi('video/mp4'), true);
  assert.equal(daGoi[0].options.contentType, 'video/mp4');
});

test('mediaKindOf: mp3 la ghi am', () => {
  assert.equal(mediaKindOf('audio/mpeg'), 'audio');
  assert.equal(mediaKindOf('application/octet-stream'), null);
});

/**
 * driveFileIdTu (issue #28): rut fileId tu link chia se Google Drive de dung
 * iframe src rieng — chot chat de khong nhet nham url la vao iframe.
 */
test('driveFileIdTu: rut duoc fileId tu link chia se dung dang', () => {
  assert.equal(
    driveFileIdTu('https://drive.google.com/file/d/1NnPqgO9iYBtIcO3WDnESJfl7MU1nKtfZ/view'),
    '1NnPqgO9iYBtIcO3WDnESJfl7MU1nKtfZ'
  );
  assert.equal(
    driveFileIdTu('https://drive.google.com/file/d/1NnPqgO9iYBtIcO3WDnESJfl7MU1nKtfZ/preview'),
    '1NnPqgO9iYBtIcO3WDnESJfl7MU1nKtfZ'
  );
  assert.equal(
    driveFileIdTu('https://drive.google.com/file/d/1NnPqgO9iYBtIcO3WDnESJfl7MU1nKtfZ/view?usp=sharing'),
    '1NnPqgO9iYBtIcO3WDnESJfl7MU1nKtfZ'
  );
});

test('driveFileIdTu: tu choi domain/dang khac de khong nhet nham iframe src', () => {
  assert.equal(driveFileIdTu('https://drive.google.com/drive/folders/abc123'), null);
  assert.equal(driveFileIdTu('https://evil.com/file/d/abc123/view'), null);
  assert.equal(driveFileIdTu('https://drive.google.com.evil.com/file/d/abc123/view'), null);
  assert.equal(driveFileIdTu('not a url'), null);
  assert.equal(driveFileIdTu(''), null);
  assert.equal(driveFileIdTu(undefined), null);
});

/**
 * tenTepNop: ten tep video nop cho co. Hien LEN MAN "Nop bai cho co" va la ten
 * that cua tep gui qua navigator.share, nen ten rong khong phai chuyen noi bo.
 *
 * Hoi quy issue #46: cach loc cu ("chi giu A-Za-z0-9") xoa sach chu Nhat/Han cua
 * ba nha demo, ra `--2026-09-02.mp4`.
 */
test('tenTepNop: bo dau tieng Viet, giu nguyen chu Nhat / Han', () => {
  assert.equal(
    tenTepNop('Bé Na', 'Tiếng Anh', '2026-09-02', 'https://x/v.mp4'),
    'Be Na-Tieng Anh-2026-09-02.mp4'
  );
  assert.equal(
    tenTepNop('さくら', '英語', '2026-09-09', 'https://x/v.mp4'),
    'さくら-英語-2026-09-09.mp4'
  );
  assert.equal(
    tenTepNop('민준', '영어', '2026-09-09', 'https://x/v.mp4'),
    '민준-영어-2026-09-09.mp4'
  );
  assert.equal(tenTepNop('Đức', 'Toán', '2026-09-02', 'https://x/v.mp4'), 'Duc-Toan-2026-09-02.mp4');
});

test('tenTepNop: loai ky tu pha ten tep va ky tu dieu khien, gop khoang trang', () => {
  assert.equal(
    tenTepNop('a/b\\c:d*e?f"g<h>i|j', 'Toán', '2026-09-02', 'https://x/v.mp4'),
    'abcdefghij-Toan-2026-09-02.mp4'
  );
  assert.equal(
    tenTepNop('Bé   Na\tHai', 'Tiếng  Anh', '2026-09-02', 'https://x/v.mp4'),
    'Be Na Hai-Tieng Anh-2026-09-02.mp4'
  );
  assert.equal(
    tenTepNop('Na\u0000Bi', 'Toán', '2026-09-02', 'https://x/v.mp4'),
    'NaBi-Toan-2026-09-02.mp4'
  );
});

test('tenTepNop: phan rong thi bo han, khong de lai dau gach thua', () => {
  assert.equal(tenTepNop('', '', '2026-09-02', 'https://x/v.mp4'), '2026-09-02.mp4');
  assert.equal(tenTepNop('...', 'Toán', '2026-09-02', 'https://x/v.mp4'), 'Toan-2026-09-02.mp4');
  assert.equal(tenTepNop('Na', '   ', '2026-09-02', 'https://x/v.mp4'), 'Na-2026-09-02.mp4');
});

test('tenTepNop: duoi tep lay tu url, bo query, khong co thi .mp4', () => {
  assert.equal(tenTepNop('Na', 'Toán', '2026-09-02', 'https://x/v.mov'), 'Na-Toan-2026-09-02.mov');
  assert.equal(
    tenTepNop('Na', 'Toán', '2026-09-02', 'https://x/v.webm?tai=1'),
    'Na-Toan-2026-09-02.webm'
  );
  assert.equal(tenTepNop('Na', 'Toán', '2026-09-02', 'https://x/khong-duoi'), 'Na-Toan-2026-09-02.mp4');
});
