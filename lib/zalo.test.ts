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
 *   1. Goi hong phai bi CHAN o day, truoc khi cham CSDL — nhung CHI khi thieu
 *      TRUONG BAT BUOC (`nguon_id` / `ma_tin` / `nguyen_van`). Moi chuyen lien
 *      quan toi TEP (sai loai, qua 25MB, thieu `url`, du ra so voi tran so tep)
 *      thi bo rieng TUNG TEP va tin VAN vao: co gui kem mot to .docx ma tra 400
 *      la tin giao bai do bi khoa vinh vien, vi zalo-agent gui lai moi 30 phut
 *      va lan nao cung 400.
 *   2. `url` cua tep phai la tep CUA KHO MINH va dung ho `zalo/<nguon>/<ngay>/`.
 *      Tep khong con di trong than request (Vercel chan o 4.5MB) nen `url` la
 *      dau vao tu ben ngoai: no phai chan duoc tep cua nguon khac, `nop-bai/`
 *      cua video con nop, va dia chi ngoai.
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
  MAX_BYTES_MOI_TEP, MAX_TEP_MOI_GOI, congNgay, docGoiTin, docNhanDien, hanNopBai,
  kiemCuaSoDinhKem, laDuongDanTepZalo, laNgayISO, laUrlBlobZaloCuaNguon, loaiTepZalo,
  maKhoBlob, matCoNhanDien, phanLoaiUrlBlobZalo, tenHienTep, tenTepZalo,
} from './zalo.ts';
import { ngayNhaISO } from './muiGio.ts';

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

/**
 * Kho tep CUA MINH. `MA_KHO` la thu `maKhoBlob` rut ra tu `BLOB_READ_WRITE_TOKEN`
 * (`vercel_blob_rw_<maKho>_<bi mat>`), va hostname cua kho mang dung ma do —
 * nen mot url `*.blob.vercel-storage.com` cua kho KHAC khong qua duoc.
 */
export const MA_KHO = 'kho';
export const KHO = `https://${MA_KHO}.public.blob.vercel-storage.com`;
/** Kho cua NGUOI KHAC — cung ten mien chung, khac ma kho. */
export const KHO_LA = 'https://kholakhac.public.blob.vercel-storage.com';

/**
 * Goi zalo-agent gui len cho tin tren — hai video den sau tin 4 giay.
 *
 * Tep KHONG di trong than goi nua: agent xin ve o `/api/nhan-bai-zalo/tep-token`
 * roi tai thang len kho, va goi tin chi mang `url` + so byte no khai. Duong
 * base64 cu lam chinh goi nay (2.18MB + 1.29MB video, ~4.63MB sau base64) bi
 * Vercel tu choi o 413 truoc khi ham chay.
 */
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
      kich_thuoc: 2_284_512,
      gui_luc: '2026-09-18T20:03:21+07:00',
      url: `${KHO}/zalo/nzl_cambridge/2026-09-18/2026-09-18-1789736601713-abc123.mp4`,
    },
    {
      ten: '2026-09-18-1789736601724.mp4',
      loai: 'video/mp4',
      kich_thuoc: 1_352_704,
      gui_luc: '2026-09-18T20:03:21+07:00',
      url: `${KHO}/zalo/nzl_cambridge/2026-09-18/2026-09-18-1789736601724-def456.mp4`,
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
  assert.equal(g.bo_qua.length, 0);
  assert.ok(g.dinh_kem.every((t) => laUrlBlobZaloCuaNguon(t.url, 'nzl_cambridge', MA_KHO)), 'url cua goi mau');
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

const tepMau = (them: Record<string, unknown> = {}) => ({
  ten: 'x.mp4',
  loai: 'video/mp4',
  kich_thuoc: 1024,
  url: `${KHO}/zalo/nzl_cambridge/2026-09-18/x-abc.mp4`,
  ...them,
});

test('loai tep nhan: anh / am thanh / video / pdf; loai khac bi BO RIENG, tin van vao', () => {
  const goi = (loai: string) => doc({ ...GOI_MAU, dinh_kem: [tepMau({ ten: 'x', loai })] });
  for (const ok of ['image/jpeg', 'image/heic', 'audio/mpeg', 'audio/x-m4a', 'video/quicktime', 'application/pdf']) {
    const kq = goi(ok);
    assert.ok('goi' in kq && kq.goi.dinh_kem.length === 1 && kq.goi.bo_qua.length === 0, ok);
  }
  for (const xau of ['application/zip', 'text/html', 'application/octet-stream', '', 'video']) {
    const kq = goi(xau);
    assert.ok('goi' in kq, `${xau}: mot tep la khong duoc lam hong ca tin`);
    assert.equal(kq.goi.dinh_kem.length, 0, xau);
    assert.deepEqual(kq.goi.bo_qua.map((t) => t.ly_do), ['loai-khong-nhan'], xau);
  }
  // Tham so charset khong duoc lam hong phep do
  assert.equal(loaiTepZalo('IMAGE/PNG; charset=binary'), 'image');
});

test('.docx cua co khong lam mat tin: bai van tach duoc, chi rieng tep bi bo', () => {
  const kq = doc({
    ...GOI_MAU,
    dinh_kem: [
      GOI_MAU.dinh_kem[0],
      tepMau({
        ten: 'worksheet.docx',
        loai: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ],
  });
  assert.ok('goi' in kq, JSON.stringify(kq));
  assert.equal(kq.goi.nguyen_van, TIN_NGAY_40, 'nguyen van tin phai con nguyen');
  assert.deepEqual(kq.goi.dinh_kem.map((t) => t.ten), [GOI_MAU.dinh_kem[0].ten]);
  assert.deepEqual(kq.goi.bo_qua, [{
    ten: 'worksheet.docx',
    ly_do: 'loai-khong-nhan',
    chi_tiet: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }]);
  // `thu_tu` la vi tri trong goi THO, khong phai trong mang da loc — mot khong
  // gian chi so duy nhat cho ca ten hien lan ten tep luu.
  assert.deepEqual(kq.goi.dinh_kem.map((t) => t.thu_tu), [0]);
});

test('thu_tu giu vi tri trong goi THO, nen hai tep khong ten khong bao gio trung nhan', () => {
  const kq = doc({
    ...GOI_MAU,
    dinh_kem: [
      tepMau({ ten: '', loai: 'application/zip' }),   // bi bo ngay o day, vi tri 0
      tepMau({ ten: '', loai: 'video/mp4' }),         // qua duoc, van phai la vi tri 1
    ],
  });
  assert.ok('goi' in kq, JSON.stringify(kq));
  assert.deepEqual(kq.goi.bo_qua.map((t) => t.ten), ['#1']);
  assert.deepEqual(kq.goi.dinh_kem.map((t) => t.thu_tu), [1]);
  assert.deepEqual(kq.goi.dinh_kem.map((t) => tenHienTep(t.ten, t.thu_tu)), ['#2']);
});

test('agent KHAI qua 25MB thi bo ngay o day, khong phai doi hoi kho tep', () => {
  const kq = doc({
    ...GOI_MAU,
    dinh_kem: [tepMau({ ten: 'to.mp4', kich_thuoc: MAX_BYTES_MOI_TEP + 1 })],
  });
  assert.ok('goi' in kq, JSON.stringify(kq).slice(0, 120));
  assert.equal(kq.goi.dinh_kem.length, 0);
  assert.equal(kq.goi.bo_qua[0].ly_do, 'qua-nang');
  assert.equal(kq.goi.bo_qua[0].ten, 'to.mp4');
  // Khai thieu / khai bua thi KHONG an duoc gi: tep van vao, so that do kho tra
  const khaiBua = doc({ ...GOI_MAU, dinh_kem: [tepMau({ kich_thuoc: 'to lam' })] });
  assert.ok('goi' in khaiBua);
  assert.equal(khaiBua.goi.dinh_kem.length, 1);
  assert.equal(khaiBua.goi.dinh_kem[0].kich_thuoc, 0);
});

test('thieu url -> bo rieng voi ly do tep-hong, tin van vao', () => {
  const rong = doc({ ...GOI_MAU, dinh_kem: [tepMau({ url: '' })] });
  assert.ok('goi' in rong);
  assert.deepEqual(rong.goi.bo_qua, [{ ten: 'x.mp4', ly_do: 'tep-hong' }]);
  // Tep khong co ten van phai co gi do de bo me doc
  const khongTen = doc({ ...GOI_MAU, dinh_kem: [tepMau({ ten: '', url: '' })] });
  assert.ok('goi' in khongTen);
  assert.equal(khongTen.goi.bo_qua[0].ten, '#1');
});

/* ---------------- Qua nhieu tep: bo TEP DU, khong hong ca tin ---------------- */

const anhSo = (n: number) => Array.from({ length: n }, (_, i) => tepMau({
  ten: `anh-${i + 1}.jpg`, loai: 'image/jpeg',
  url: `${KHO}/zalo/nzl_cambridge/2026-09-18/anh-${i + 1}.jpg`,
}));

test('goi 12 anh hop le: giu 10 tep dau, 2 tep du vao bo_qua — tin KHONG hong', () => {
  // Mot tin co gui 12 tam anh la tin HOP LE co nhieu tep hon muc app xu. Tra 400
  // cho ca goi la khoa vinh vien tin do (agent gui lai moi 30 phut), va tu khi
  // tep duoc tai len TRUOC qua ve thi no con de lai 12 tep mo coi moi luot.
  const kq = doc({ ...GOI_MAU, dinh_kem: anhSo(12) });
  assert.ok('goi' in kq, JSON.stringify(kq));
  assert.equal(kq.goi.dinh_kem.length, MAX_TEP_MOI_GOI);
  const du = kq.goi.bo_qua.filter((t) => t.ly_do === 'qua-nhieu-tep');
  assert.equal(du.length, 2);
  // Ten hien va chi_tiet: dung tep bi cat, va tong so tep trong tin
  assert.deepEqual(du.map((t) => t.ten), ['anh-11.jpg', 'anh-12.jpg']);
  assert.deepEqual(du.map((t) => t.chi_tiet), ['12', '12']);
  // Muoi tep giu lai phai la muoi tep DAU, khong phai mot tap bat ky
  assert.deepEqual(kq.goi.dinh_kem.map((t) => t.thu_tu), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('THU TU: loc tung tep TRUOC, cat theo tran SAU — tep hong khong chiem suat cua tep lanh', () => {
  // 12 tep, 3 trong so do sai loai. Loc truoc thi con 9 tep lanh -> KHONG ai bi
  // cat. Cat truoc thi 10 tep dau (gom ca 3 tep .docx) chiem het suat va 2 tep
  // anh lanh o cuoi bi bo oan — dao thu tu la bai nay do.
  const tep = anhSo(12);
  for (const i of [0, 4, 9]) {
    tep[i] = tepMau({ ten: `worksheet-${i}.docx`, loai: 'application/zip',
                      url: `${KHO}/zalo/nzl_cambridge/2026-09-18/w-${i}.docx` });
  }
  const kq = doc({ ...GOI_MAU, dinh_kem: tep });
  assert.ok('goi' in kq, JSON.stringify(kq));
  assert.equal(kq.goi.dinh_kem.length, 9);
  assert.equal(kq.goi.bo_qua.filter((t) => t.ly_do === 'loai-khong-nhan').length, 3);
  assert.equal(kq.goi.bo_qua.filter((t) => t.ly_do === 'qua-nhieu-tep').length, 0);
});

test('du ba truong bat buoc thi docGoiTin KHONG BAO GIO tra loi, dinh kem the nao cung vay', () => {
  const dayDu = { nguon_id: 'nzl_cambridge', ma_tin: 'm', nguyen_van: 'co giao bai' };
  for (const dinhKem of [
    undefined, null, [], 'khong-phai-mang', 42,
    anhSo(200),
    Array.from({ length: 30 }, () => tepMau({ loai: 'application/zip' })),
    Array.from({ length: 30 }, () => tepMau({ url: '' })),
    Array.from({ length: 30 }, () => tepMau({ kich_thuoc: MAX_BYTES_MOI_TEP + 1 })),
    [null, undefined, {}, 'rac'],
  ]) {
    const kq = doc({ ...dayDu, dinh_kem: dinhKem });
    assert.ok('goi' in kq, `dinh_kem=${JSON.stringify(dinhKem)?.slice(0, 60)}: ${JSON.stringify(kq)}`);
    assert.ok(kq.goi.dinh_kem.length <= MAX_TEP_MOI_GOI);
  }
});

test('ma_nhom la truong TUY CHON: co thi doc ra, khong thi null', () => {
  const co = doc({ ...GOI_MAU, ma_nhom: 'g6948518348545773767' });
  assert.ok('goi' in co, JSON.stringify(co));
  assert.equal(co.goi.ma_nhom, 'g6948518348545773767');
  const khong = doc(GOI_MAU);
  assert.ok('goi' in khong);
  assert.equal(khong.goi.ma_nhom, null, 'khong gui thi khong bia ra ma');
  const la = doc({ ...GOI_MAU, ma_nhom: 123 });
  assert.ok('goi' in la);
  assert.equal(la.goi.ma_nhom, null);
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

test('han nop: nhanh "lui ve ngay GUI" phai CHAY THAT khi ngay gui KHAC hom nay', () => {
  // zalo-agent offline qua dem roi quet lai: tin gui 2026-09-17 luc 22h gio nha,
  // trong tin khong doc ra ngay, hom nay la 2026-09-19.
  // Dung: ngay gui + 1 = 18/9, kep len hom nay = 19/9.
  // Sai (so `laNgayISO` thang tren mot MOC ISO): roi xuong `homNay` + 1 = 20/9,
  // tuc bai cua con tre mot ngay ma khong bao gi.
  assert.equal(hanNopBai(null, '2026-09-17T22:00:00+07:00', '2026-09-19'), '2026-09-19');
  // Tin gui hom qua, chua toi han hom nay -> ngay gui + 1 = hom nay
  assert.equal(hanNopBai(null, '2026-09-18T20:03:17+07:00', '2026-09-19'), '2026-09-19');
  // Tin gui NGAY MAI (dong ho may gui chay truoc) -> mai + 1, khong bi kep
  assert.equal(hanNopBai(null, '2026-09-20T08:00:00+07:00', '2026-09-19'), '2026-09-21');
  // Moc hong thi ve `homNay` + 1, khong nem
  assert.equal(hanNopBai(null, 'khong-phai-moc', '2026-09-19'), '2026-09-20');
});

test('han nop doc ngay gui theo MUI GIO NHA, khong theo TZ cua may chay', () => {
  // 22h gio nha ngay 18/9 = 15:00 UTC cung ngay; nhung 00:30 gio nha ngay 19/9
  // la 17:30 UTC ngay 18/9 — doc theo UTC la lui mot ngay (lop loi cua issue #75).
  const nuaDemGioNha = '2026-09-19T00:30:00+07:00';
  assert.equal(ngayNhaISO(new Date(nuaDemGioNha)), '2026-09-19');
  assert.equal(hanNopBai(null, nuaDemGioNha, '2026-09-19'), '2026-09-20');
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

test('maKhoBlob: rut ma kho tu token, token sai khuon thi KHONG co kho hop le', () => {
  assert.equal(maKhoBlob('vercel_blob_rw_Abc123_bimat'), 'abc123');
  // Doc khong ra thi TU CHOI, khong lui ve "nhan tat" — cung tinh than voi
  // `tranNguoiDat` tren duong xoa khong lui duoc.
  for (const xau of ['', 'vercel_blob_rw_test', 'vercel_blob_rw__x', 'rac', null, undefined]) {
    assert.equal(maKhoBlob(xau), null, String(xau));
  }
});

test('url cua tep phai la tep CUA KHO MINH, dung ho zalo/<nguon>/<ngay>/', () => {
  const ok = `${KHO}/zalo/nzl_cambridge/2026-09-18/video-abc123.mp4`;
  assert.ok(laUrlBlobZaloCuaNguon(ok, 'nzl_cambridge', MA_KHO));
  // Ten tep bi `addRandomSuffix` doi van phai qua — ve chi chot THU MUC
  assert.ok(laUrlBlobZaloCuaNguon(`${KHO}/zalo/nzl_cambridge/2026-09-18/x-9f2.pdf`, 'nzl_cambridge', MA_KHO));
  // `<maKho>.blob…` (khong co `public`) cung la kho cua minh
  assert.ok(laUrlBlobZaloCuaNguon(
    `https://${MA_KHO}.blob.vercel-storage.com/zalo/nzl_cambridge/2026-09-18/v.mp4`,
    'nzl_cambridge', MA_KHO));

  // KHO CUA NGUOI KHAC: cung ten mien chung `*.blob.vercel-storage.com`, nen
  // phep kiem cu (chi so hau to) cho qua. Day la loai RIENG de cua nhan bo tep
  // voi ly do 'ngoai-kho' thay vi de nhanh "loi tam thoi thi GIU tep" nhan no.
  const laKho = `${KHO_LA}/zalo/nzl_cambridge/2026-09-18/video.mp4`;
  assert.equal(phanLoaiUrlBlobZalo(laKho, 'nzl_cambridge', MA_KHO), 'kho-la');
  assert.ok(!laUrlBlobZaloCuaNguon(laKho, 'nzl_cambridge', MA_KHO));
  // Khong co ma kho hop le -> moi url Blob deu bi tu choi, KE CA host cua minh
  assert.equal(phanLoaiUrlBlobZalo(ok, 'nzl_cambridge', null), 'kho-la');

  for (const xau of [
    // Nguon KHAC: mot khoa hop le khong duoc tro sang ho cua lop khac
    `${KHO}/zalo/nzl_starters/2026-09-18/video.mp4`,
    // Ho cua video con nop — hai ho tep khong bao gio duoc dam vao nhau
    `${KHO}/nop-bai/be-na.mp4`,
    // Dia chi ngoai: trinh duyet cua bo me se tai no ve khi mo muc cho duyet
    'https://evil.example.com/zalo/nzl_cambridge/2026-09-18/video.mp4',
    // Host gan giong
    'https://blob.vercel-storage.com.evil.com/zalo/nzl_cambridge/2026-09-18/v.mp4',
    // Khong phai https
    `${KHO.replace('https', 'http')}/zalo/nzl_cambridge/2026-09-18/video.mp4`,
    // Thu muc long nhau / thieu ngay / ngay khong co that
    `${KHO}/zalo/nzl_cambridge/2026-09-18/them/video.mp4`,
    `${KHO}/zalo/nzl_cambridge/video.mp4`,
    `${KHO}/zalo/nzl_cambridge/2026-02-30/video.mp4`,
    // Lach ra ngoai thu muc cua nguon
    `${KHO}/zalo/nzl_cambridge/../nzl_starters/video.mp4`,
    '', 'khong-phai-url', null, 123,
  ]) {
    assert.ok(!laUrlBlobZaloCuaNguon(xau, 'nzl_cambridge', MA_KHO), String(xau));
  }
});

test('laDuongDanTepZalo: khuon zalo/<nguon>/<ngay>/<mot doan> — btvn chi DUYET, agent moi dat ten', () => {
  // btvn khong sinh duong dan nua; day la hop dong ma zalo-agent phai dat theo,
  // va no duoc doc o hai cho phai giong nhau (cua phat ve chan pathname truoc khi
  // ky, cua nhan tin doi chieu `url`). Nen doi chieu thang voi duong dan viet tay.
  for (const dung of [
    'zalo/nzl_cambridge/2026-09-18/video-mau.mp4',
    // `addRandomSuffix` doi ten tep: ve chi chot THU MUC
    'zalo/nzl_cambridge/2026-09-18/video-mau-abc123.mp4',
    // Dang co dau '/' dau (pathname cua URL) cung phai nhan
    '/zalo/nzl_cambridge/2026-09-18/x.pdf',
  ]) {
    assert.ok(laDuongDanTepZalo(dung, 'nzl_cambridge'), dung);
    assert.ok(!laDuongDanTepZalo(dung, 'nzl_starters'), `${dung} khong duoc qua o nguon khac`);
  }

  for (const xau of [
    'nop-bai/x.mp4',                                   // ho cua video con nop
    'zalo/nzl_starters/2026-09-18/video.mp4',          // ho cua nguon khac
    'zalo/nzl_cambridge/2026-09-18/them/video.mp4',    // thu muc long nhau
    'zalo/nzl_cambridge/video.mp4',                    // thieu ngay
    'zalo/nzl_cambridge/2026-02-30/video.mp4',         // ngay khong co that
    'zalo/nzl_cambridge/2026-09-18/',                  // thieu ten tep
    'zalo/nzl_cambridge/../nzl_starters/video.mp4',    // lach ra ngoai ho
    'video.mp4', '', null, 123,
  ]) {
    assert.ok(!laDuongDanTepZalo(xau, 'nzl_cambridge'), String(xau));
  }

  // Mot `nguon_id` mang ky tu la khong keo duong dan ra khoi ho duoc: `sachDoan`
  // thay chung TRUOC khi so, va khuon van doi dung bon doan.
  for (const xau of [
    'zalo/../../evil/2026-09-18/passwd',
    'zalo/../../../etc/passwd',
    '../../evil/2026-09-18/x.mp4',
  ]) {
    assert.ok(!laDuongDanTepZalo(xau, '../../evil'), xau);
    assert.ok(!laDuongDanTepZalo(xau, 'nzl_cambridge'), xau);
  }
});

/* ---------------- Cua so nhan tep ---------------- */

test('cua so nhan tep: video mau sau tin 4 GIAY thi nhan, tep nhan xet sau 4 TIENG thi khong', () => {
  const tin = '2026-09-18T20:03:17+07:00';
  // Hai ca THAT do tren tin cua co (migration 021)
  assert.equal(kiemCuaSoDinhKem(tin, '2026-09-18T20:03:21+07:00', 90), 'trong-cua-so');
  assert.equal(kiemCuaSoDinhKem(tin, '2026-09-19T00:15:00+07:00', 90), 'ngoai-cua-so');

  // Hai dau khoang tinh la TRONG cua so
  assert.equal(kiemCuaSoDinhKem(tin, tin, 90), 'trong-cua-so');
  assert.equal(kiemCuaSoDinhKem(tin, '2026-09-18T21:33:17+07:00', 90), 'trong-cua-so');
  assert.equal(kiemCuaSoDinhKem(tin, '2026-09-18T21:33:18+07:00', 90), 'ngoai-cua-so');

  // Mui gio khac nhau van so dung mot moc tuyet doi
  assert.equal(kiemCuaSoDinhKem(tin, '2026-09-18T13:03:21Z', 90), 'trong-cua-so');

  // Tep co TU TRUOC tin khong phai tep cua bai nay
  assert.equal(kiemCuaSoDinhKem(tin, '2026-09-18T20:03:16+07:00', 90), 'ngoai-cua-so');

  // Bo me noi so phut ra thi tep muon lot vao
  assert.equal(kiemCuaSoDinhKem(tin, '2026-09-19T00:15:00+07:00', 1440), 'trong-cua-so');
});

test('cua so nhan tep: khong co moc thi KHONG bo tep, thieu gio tep thi bao rieng', () => {
  const tin = '2026-09-18T20:03:17+07:00';
  // TIN khong co gui_luc: khong co moc nao de tinh, dung bien "khong biet" thanh
  // "bo het tep cua tin"
  assert.equal(kiemCuaSoDinhKem(null, null, 90), 'trong-cua-so');
  assert.equal(kiemCuaSoDinhKem(null, '2026-09-19T00:15:00+07:00', 90), 'trong-cua-so');
  assert.equal(kiemCuaSoDinhKem('khong-phai-moc', '2026-09-19T00:15:00+07:00', 90), 'trong-cua-so');

  // TEP khong co gui_luc ma tin thi co: khong doi chieu duoc
  assert.equal(kiemCuaSoDinhKem(tin, null, 90), 'thieu-gio-gui');
  assert.equal(kiemCuaSoDinhKem(tin, 'hong', 90), 'thieu-gio-gui');
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
