/**
 * Phan THUAN cua cua nhan bai tu Zalo (lib/zalo.ts): doc goi tin, luat han nop,
 * luat tep, co nhan dien.
 *
 * Kiem bang GOI MAU THAT — tin "ngay hoc thu 40" scout lay ve tu nhom
 * "Cambridge 1.27 - Smart Kids Education" ngay 2026-09-18 (bao cao
 * `data/zalo-agent-lay-tin-nhan-co/ket-qua-2026-09-20/latest.json` trong home
 * firstmate). Nguyen van chep NGUYEN XI vao day chu khong doc tu tep ngoai kho:
 * bo kiem phai chay duoc tren may nao co kho nay, khong phu thuoc mot thu muc
 * o may captain.
 *
 * Nhung dieu de vo ma khong ai thay, kiem o day:
 *   1. Goi hong phai bi CHAN o day, truoc khi cham CSDL: thieu truong, tep sai
 *      loai, tep qua 25MB, qua nhieu tep.
 *   2. So byte cua tep tinh TU CHUOI base64, khong decode — mot goi 200MB
 *      khong duoc phep thanh Buffer trong ham serverless truoc khi bi tu choi.
 *   3. Han nop = ngay trong tin + 1, va KHONG BAO GIO la ngay qua khu.
 *   4. `congNgay` chay tren lich UTC: may dev +07 va ham Vercel TZ=UTC phai ra
 *      cung mot ngay (cung lop loi voi issue #75).
 *   5. Thu muc Blob la `zalo/...`, KHONG cham `nop-bai/` cua video con nop —
 *      hang rao 3 cua lib/donVideo.ts chi nhan `nop-bai/`, nen hai ho tep khong
 *      bao gio dam vao nhau.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BYTES_MOI_TEP, MAX_TEP_MOI_GOI, bytesCuaBase64, congNgay, docGoiTin, docNhanDien,
  duongDanBlobZalo, hanNopBai, laNgayISO, loaiTepZalo, matCoNhanDien, tenTepZalo,
} from './zalo.ts';

/** Nguyen van tin cua co — ngay hoc thu 40, thu 6 (18/9/2026). */
export const TIN_NGAY_40 =
  'Cô Huyền thân gửi bố mẹ bài tập về nhà của con ngày học thứ 40, nằm trong chương trình Cambridge 1, thứ 6 (18/9/2026) như sau:\n' +
  '* Phần Jolly Phonics:\n' +
  '1. Luyện đọc từ trong tờ Worksheet /ee/ sound family gồm ee,ea,  Con xem video mẫu của cô để biết cách blend, con đọc và đặt câu với mỗi từ, con quay gửi cho cô\n' +
  '2. Con luyện tập viết các từ chứa âm /ee/ family vào vở của mình.\n\n\n' +
  '* Phần tiếng anh – English:\n' +
  '1.Sách Cambridge Global English Workbook 1 (trang 46,47): Con hoàn thành bài tập liên quan đến câu chuyện con học.\n' +
  '2. Con mở loa track 38 và nghe câu chuyện tối thiểu 30 phút cho đến khi kể lại được câu chuyện để có thể đóng kịch với các bạn.\n' +
  '3. Con luyện viết các từ scary, run, flap, nut, jump, silly, wise ra vở của mình.\n\n\n' +
  '*Góc xem phim (quan trọng): con tiếp tục xem bộ phim “The Pet Lovers Club” mà cô đã gửi trong nhóm film\n' +
  'Cô cảm ơn bố mẹ!';

/** Goi zalo-agent gui len cho tin tren — hai video den sau tin 4 giay. */
export const GOI_MAU = {
  nguon_id: 'nzl_cambridge',
  ma_tin: 'bb_msg_id_1789736597562',
  gui_luc: '2026-09-18T20:03:17+07:00',
  nguoi_gui: 'Thu Huyền',
  nhom_zalo: 'Cambridge 1.27 - Smart Kids Education',
  ngay_hoc_so: 40,
  ngay_trong_tin: '2026-09-18',
  nguyen_van: TIN_NGAY_40,
  dinh_kem: [
    {
      ten: '2026-09-18-1789736601713.mp4',
      loai: 'video/mp4',
      gui_luc: '2026-09-18T20:03:21+07:00',
      noi_dung_base64: Buffer.from('video mau 1').toString('base64'),
    },
    {
      ten: '2026-09-18-1789736601724.mp4',
      loai: 'video/mp4',
      gui_luc: '2026-09-18T20:03:21+07:00',
      noi_dung_base64: Buffer.from('video mau 2').toString('base64'),
    },
  ],
};

const doc = (b: unknown) => docGoiTin(b);

/* ---------------- Goi mau that ---------------- */

test('goi mau that (ngay hoc thu 40, hai video): doc ra du moi truong', () => {
  const kq = doc(GOI_MAU);
  assert.ok('goi' in kq, JSON.stringify(kq));
  const g = kq.goi;
  assert.equal(g.nguon_id, 'nzl_cambridge');
  assert.equal(g.ma_tin, 'bb_msg_id_1789736597562');
  assert.equal(g.gui_luc, '2026-09-18T20:03:17+07:00');
  assert.equal(g.nguoi_gui, 'Thu Huyền');
  assert.equal(g.nhom_zalo, 'Cambridge 1.27 - Smart Kids Education');
  assert.equal(g.ngay_hoc_so, 40);
  assert.equal(g.ngay_trong_tin, '2026-09-18');
  assert.equal(g.dinh_kem.length, 2);
  // Xuong dong PHAI giu nguyen: man bo me ve nguyen van bang whitespace-pre-wrap
  // de doi chieu voi danh sach bai da tach — do thang thanh mot doan la hong
  // dung viec man do sinh ra de lam.
  assert.ok(g.nguyen_van.includes('\n* Phần Jolly Phonics:\n'));
  assert.equal(g.nguyen_van, TIN_NGAY_40);
  assert.equal(g.nhan_dien, null, 'goi khong co nhan_dien thi khong bia ra co');
});

test('han nop cua goi mau = ngay trong tin + 1 (co dang toi nay cho buoi sau)', () => {
  assert.equal(hanNopBai('2026-09-18', '2026-09-18T20:03:17+07:00', '2026-09-18'), '2026-09-19');
});

/* ---------------- Goi hong ---------------- */

test('thieu truong bat buoc -> ma loi ro, khong doan bua', () => {
  assert.deepEqual(doc({}), { loi: 'thieu-nguon-id' });
  assert.deepEqual(doc({ nguon_id: 'n' }), { loi: 'thieu-ma-tin' });
  assert.deepEqual(doc({ nguon_id: 'n', ma_tin: 'm' }), { loi: 'thieu-nguyen-van' });
  assert.deepEqual(doc({ nguon_id: 'n', ma_tin: 'm', nguyen_van: '   ' }), { loi: 'thieu-nguyen-van' });
  assert.deepEqual(doc(null), { loi: 'thieu-nguon-id' });
});

test('tep sai loai bi tu choi ca goi (chi anh / am thanh / video / pdf)', () => {
  const goi = (loai: string) => doc({
    ...GOI_MAU,
    dinh_kem: [{ ten: 'x', loai, noi_dung_base64: Buffer.from('x').toString('base64') }],
  });
  for (const ok of ['image/jpeg', 'image/heic', 'audio/mpeg', 'audio/x-m4a', 'video/quicktime', 'application/pdf']) {
    assert.ok('goi' in goi(ok), ok);
  }
  for (const xau of ['application/zip', 'text/html', 'application/octet-stream', '', 'video']) {
    const kq = goi(xau);
    assert.ok('loi' in kq && kq.loi === 'tep-sai-loai', xau);
  }
  // Tham so charset khong duoc lam hong phep do
  assert.equal(loaiTepZalo('IMAGE/PNG; charset=binary'), 'image');
});

test('tep qua 25MB bi tu choi, va so byte tinh tu CHUOI base64 chu khong decode', () => {
  // 4 ky tu base64 = 3 byte; khong co dau '=' nen khong tru gi
  assert.equal(bytesCuaBase64('AAAA'), 3);
  assert.equal(bytesCuaBase64('AAA='), 2);
  assert.equal(bytesCuaBase64('AA=='), 1);
  // Chuoi dai hon tran ma KHONG can dung mot Buffer nao
  const soKyTu = Math.ceil(((MAX_BYTES_MOI_TEP + 1024) * 4) / 3);
  const to = 'A'.repeat(soKyTu);
  assert.ok(bytesCuaBase64(to) > MAX_BYTES_MOI_TEP);
  const kq = doc({ ...GOI_MAU, dinh_kem: [{ ten: 'to.mp4', loai: 'video/mp4', noi_dung_base64: to }] });
  assert.ok('loi' in kq && kq.loi === 'tep-qua-nang', JSON.stringify(kq).slice(0, 120));
});

test('tep rong / khong co noi dung -> tep-hong; qua nhieu tep -> qua-nhieu-tep', () => {
  const rong = doc({ ...GOI_MAU, dinh_kem: [{ ten: 'x.mp4', loai: 'video/mp4', noi_dung_base64: '' }] });
  assert.ok('loi' in rong && rong.loi === 'tep-hong');
  const nhieu = doc({
    ...GOI_MAU,
    dinh_kem: Array.from({ length: MAX_TEP_MOI_GOI + 1 }, () => GOI_MAU.dinh_kem[0]),
  });
  assert.ok('loi' in nhieu && nhieu.loi === 'qua-nhieu-tep');
});

test('truong la thi degrade, khong nem: ngay/moc/so hong ve null', () => {
  const kq = doc({
    ...GOI_MAU,
    gui_luc: 'khong-phai-ngay',
    ngay_trong_tin: '2026-13-40',
    ngay_hoc_so: 'bon muoi',
    dinh_kem: [],
  });
  assert.ok('goi' in kq);
  assert.equal(kq.goi.gui_luc, null);
  assert.equal(kq.goi.ngay_trong_tin, null);
  assert.equal(kq.goi.ngay_hoc_so, null);
});

test('laNgayISO tu choi ngay Date tu chuan hoa duoc ("2026-02-30")', () => {
  assert.ok(laNgayISO('2026-09-18'));
  assert.ok(!laNgayISO('2026-02-30'));
  assert.ok(!laNgayISO('2026-13-01'));
  assert.ok(!laNgayISO('18/9/2026'));
  assert.ok(!laNgayISO(''));
  assert.ok(!laNgayISO(null));
});

/* ---------------- Han nop ---------------- */

test('han nop: khong co ngay trong tin -> lui ve ngay GUI + 1; khong co ca hai -> hom nay + 1', () => {
  assert.equal(hanNopBai(null, '2026-09-18T20:03:17+07:00', '2026-09-18'), '2026-09-19');
  assert.equal(hanNopBai(null, null, '2026-09-18'), '2026-09-19');
});

test('han nop KHONG BAO GIO la ngay qua khu — tin cu gui vao thi han la hom nay', () => {
  // zalo-agent quet lai mot tin tu tuan truoc: ngay trong tin + 1 van la qua khu
  assert.equal(hanNopBai('2026-09-01', null, '2026-09-18'), '2026-09-18');
  // Dung ranh gioi: tin cua hom qua -> han la hom nay, khong phai hom qua
  assert.equal(hanNopBai('2026-09-17', null, '2026-09-18'), '2026-09-18');
});

test('congNgay chay tren lich UTC — khong phu thuoc TZ cua may chay, va qua dung thang/nam', () => {
  assert.equal(congNgay('2026-09-18', 1), '2026-09-19');
  assert.equal(congNgay('2026-09-30', 1), '2026-10-01');
  assert.equal(congNgay('2026-12-31', 1), '2027-01-01');
  assert.equal(congNgay('2028-02-28', 1), '2028-02-29', 'nam nhuan');
  assert.equal(congNgay('2026-09-18', 30), '2026-10-18');
});

/* ---------------- Tep: ten va thu muc tren kho ---------------- */

test('thu muc Blob la zalo/<nguon>/<ngay>/ va KHONG cham nop-bai/ cua video con nop', () => {
  const d = duongDanBlobZalo('nzl_cambridge', '2026-09-18', 'video mau (1).mp4');
  assert.ok(d.startsWith('zalo/nzl_cambridge/2026-09-18/'), d);
  assert.ok(!d.includes('nop-bai/'), d);
  // Ky tu la trong ten bi thay, khong de lot '..' hay '/' xuong duong dan
  const hiem = duongDanBlobZalo('../../evil', '2026-09-18', '../../../etc/passwd');
  assert.ok(!hiem.includes('..'), hiem);
  assert.equal(hiem.split('/').length, 4, hiem);
});

test('ten tep tu Zalo khong co duoi thi dat theo loai + thu tu', () => {
  assert.equal(tenTepZalo('GE_1_Track_38.mp3', 'audio', 0), 'GE_1_Track_38.mp3');
  assert.equal(tenTepZalo('', 'video', 0), 'video-1.mp4');
  assert.equal(tenTepZalo('', 'audio', 1), 'audio-2.m4a');
  assert.equal(tenTepZalo('anh chup', 'image', 0), 'anh chup.jpg');
});

/* ---------------- Co nhan dien (zalo-agent gui kem) ---------------- */

test('nhan_dien: ba mat cua co, va thieu truong thi khong co co nao', () => {
  assert.equal(matCoNhanDien(docNhanDien({ luat: true, jev_xac_suat: 0.93 })), 'luat-khop');
  assert.equal(matCoNhanDien(docNhanDien({ luat: false, jev_xac_suat: 0.93 })), 'jev-doan');
  assert.equal(matCoNhanDien(docNhanDien({ luat: false, jev_xac_suat: null })), 'chua-qua-jev');
  assert.equal(docNhanDien(undefined), null);
  assert.equal(docNhanDien({ jev_xac_suat: 0.9 }), null, 'thieu `luat` thi coi nhu khong gui');
  assert.equal(matCoNhanDien(null), null);
});

test('nhan_dien: xac suat la thi ve null, ngoai [0,1] thi kep lai', () => {
  assert.equal(docNhanDien({ luat: false, jev_xac_suat: 'cao' })?.jev_xac_suat, null);
  assert.equal(docNhanDien({ luat: false, jev_xac_suat: NaN })?.jev_xac_suat, null);
  assert.equal(docNhanDien({ luat: false, jev_xac_suat: 1.4 })?.jev_xac_suat, 1);
  assert.equal(docNhanDien({ luat: false, jev_xac_suat: -2 })?.jev_xac_suat, 0);
});
