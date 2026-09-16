/**
 * Test cho lib/nhomNhiemVu.ts — noi dinh nghia DUY NHAT "dong nao nam tren man
 * cua con": `veTrenManCuaCon` / `dongTrenManCuaCon` (dung o CA
 * app/con/[childId]/page.tsx lan `progressUpcoming` trong lib/store.ts) va
 * `nhomNhiemVuHomNay` (tach hai nhom).
 *
 * Vi sao co file nay, hai ve:
 *   1. Dong nhiem vu tick duoc la an ⭐ ngay (issue #42 Q4/Q5). Dong cua NGAY MAI
 *      van duoc tao san (saveSubmission goi taoNhiemVuNgay), nen ve chung ra la
 *      con bam "Đánh răng buổi tối" cua mai tu toi nay: ⭐ truoc mot ngay, sang
 *      mai dong do da tick san. Bai TAP cua ngay mai cung khong hien (issue #62).
 *   2. Bat bien "tap DEM == tap VE" (AGENTS.md): con so tom tat (huy hieu
 *      "N viec" o man chon ten, hai o cua bo me) chi duoc dem nhung dong man cua
 *      con VE RA va cho TICK. Test cuoi file ghim dung dieu do tren mot fixture.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dongTrenManCuaCon, nhomBaiTheoNoiGiao, nhomNhiemVuHomNay, soSanhNgayTrenManCuaCon, tienDoNhom,
  veTrenManCuaCon,
} from './nhomNhiemVu.ts';
import { HW_SOURCES, NHOM_NHIEM_VU, type Assignment, type HwSource, type NhomNhiemVu } from './types.ts';

const HOM_QUA = '2026-09-07';
const HOM_KIA = '2026-09-06';
const HOM_NAY = '2026-09-08';
const NGAY_MAI = '2026-09-09';
const NHOMS = Object.keys(NHOM_NHIEM_VU) as NhomNhiemVu[];

/** Mot dong assignments toi gian — chi cac truong ham nay doc den la co nghia. */
function dong(p: {
  id: string; dueDate: string; choreId?: string | null; choreNhom?: NhomNhiemVu | null;
  status?: 'todo' | 'done'; source?: HwSource;
}): Assignment {
  return {
    id: p.id, submissionId: null, childId: 'con', subject: 'Việc nhà', icon: '🧹',
    content: p.id, note: null, lang: 'vi', dueDate: p.dueDate,
    source: p.source ?? 'primary_school',
    status: p.status ?? 'todo', completedAt: null, imageUrl: null, media: [],
    durationMinutes: 10, requiresVideo: false, submittedVideoUrl: null, submittedVideoAt: null,
    choreId: p.choreId === undefined ? 'chr' : p.choreId,
    startedAt: null, stars: 1, choreNhom: p.choreNhom === undefined ? 'after_study' : p.choreNhom,
  };
}

const ids = (ds: Assignment[]) => ds.map((a) => a.id).sort();

test('chi ve dong nhiem vu cua HOM NAY — dong cua ngay mai bi bo ra', () => {
  const items = [
    dong({ id: 'nv_hom_nay', dueDate: HOM_NAY }),
    dong({ id: 'nv_ngay_mai', dueDate: NGAY_MAI }),
  ];

  const nhoms = nhomNhiemVuHomNay(items, HOM_NAY, NHOMS);
  assert.deepEqual(
    nhoms.map((g) => g.items.map((a) => a.id)),
    [['nv_hom_nay']],
    'dong cua ngay mai khong duoc ve — tick duoc la an sao truoc mot ngay'
  );
});

test('bai tap that khong bao gio vao nhom nhiem vu (du cung ngay)', () => {
  const items = [
    dong({ id: 'bai_hom_nay', dueDate: HOM_NAY, choreId: null, choreNhom: null }),
    dong({ id: 'nv_hom_nay', dueDate: HOM_NAY }),
  ];

  const nhoms = nhomNhiemVuHomNay(items, HOM_NAY, NHOMS);
  assert.deepEqual(nhoms.map((g) => g.items.map((a) => a.id)), [['nv_hom_nay']]);
});

test('hai nhom tach rieng, dung thu tu NHOM_NHIEM_VU, giu thu tu dong', () => {
  const items = [
    dong({ id: 'a1', dueDate: HOM_NAY, choreNhom: 'after_study' }),
    dong({ id: 'h1', dueDate: HOM_NAY, choreNhom: 'housework' }),
    dong({ id: 'a2', dueDate: HOM_NAY, choreNhom: 'after_study' }),
    dong({ id: 'h2', dueDate: NGAY_MAI, choreNhom: 'housework' }),
  ];

  const nhoms = nhomNhiemVuHomNay(items, HOM_NAY, NHOMS);
  assert.deepEqual(nhoms.map((g) => g.nhom), ['after_study', 'housework']);
  assert.deepEqual(nhoms.map((g) => g.items.map((a) => a.id)), [['a1', 'a2'], ['h1']]);
});

test('nhom khong co dong nao cua hom nay thi khong hien', () => {
  const items = [dong({ id: 'h_mai', dueDate: NGAY_MAI, choreNhom: 'housework' })];
  assert.deepEqual(nhomNhiemVuHomNay(items, HOM_NAY, NHOMS), []);
});

test('dong viec nha cu (choreNhom null) roi vao nhom DAU, khong bi bo roi', () => {
  // daily_chores khong con nhom (dong tao truoc migration 016 / cau hinh da bo):
  // van phai ve, khong thi con co mot viec dang 'todo' ma khong duong nao tick.
  const items = [dong({ id: 'nv_cu', dueDate: HOM_NAY, choreNhom: null })];

  const nhoms = nhomNhiemVuHomNay(items, HOM_NAY, NHOMS);
  assert.deepEqual(nhoms.map((g) => g.nhom), [NHOMS[0]]);
  assert.deepEqual(nhoms[0].items.map((a) => a.id), ['nv_cu']);
});

test('dong da tick cua hom nay van duoc ve (de con thay minh da xong)', () => {
  const items = [
    dong({ id: 'nv_xong', dueDate: HOM_NAY, status: 'done' }),
    dong({ id: 'nv_chua', dueDate: HOM_NAY }),
  ];
  assert.deepEqual(
    nhomNhiemVuHomNay(items, HOM_NAY, NHOMS)[0].items.map((a) => a.id),
    ['nv_xong', 'nv_chua']
  );
});

test('bat bien: tap DEM (con so tom tat) == tap VE (man cua con) tren cung fixture', () => {
  // Fixture co du moi kieu dong ma man cua con co the nhan: bai/nhiem vu, hom
  // nay/ngay mai/ngay kia, todo/done, dong viec nha cu khong con nhom, va hai
  // noi giao khac nhau.
  const NGAY_KIA = '2026-09-10';
  const fixture = [
    dong({ id: 'bai_hom_nay', dueDate: HOM_NAY, choreId: null, choreNhom: null }),
    dong({ id: 'bai_hom_nay_xong', dueDate: HOM_NAY, choreId: null, choreNhom: null, status: 'done' }),
    dong({ id: 'bai_ngay_mai', dueDate: NGAY_MAI, choreId: null, choreNhom: null, source: 'english_class' }),
    dong({ id: 'bai_ngay_kia', dueDate: NGAY_KIA, choreId: null, choreNhom: null }),
    // issue #55: bai qua han CHUA XONG o lai, bai qua han DA XONG thi khong.
    dong({ id: 'bai_hom_qua_no', dueDate: HOM_QUA, choreId: null, choreNhom: null }),
    dong({ id: 'bai_hom_qua_xong', dueDate: HOM_QUA, choreId: null, choreNhom: null, status: 'done' }),
    // Dong NHIEM VU cua hom qua van bi loai du con 'todo' — man cua con chi ve
    // nhiem vu cua hom nay, tick mot viec nha cua hom qua khong con nghia gi.
    dong({ id: 'nv_hom_qua', dueDate: HOM_QUA, choreNhom: 'housework' }),
    dong({ id: 'nv_hom_nay_a', dueDate: HOM_NAY, choreNhom: 'after_study' }),
    dong({ id: 'nv_hom_nay_h', dueDate: HOM_NAY, choreNhom: 'housework', status: 'done' }),
    dong({ id: 'nv_hom_nay_cu', dueDate: HOM_NAY, choreNhom: null }),
    dong({ id: 'nv_ngay_mai', dueDate: NGAY_MAI, choreNhom: 'housework' }),
    dong({ id: 'nv_ngay_mai_xong', dueDate: NGAY_MAI, choreNhom: 'after_study', status: 'done' }),
  ];

  // Tap DEM: dung buoc loc `upcoming` cua progressUpcoming (lib/store.ts) —
  // cung ham nay, tren du lieu dang {choreId, dueDate}.
  const demDuoc = fixture.filter((a) => veTrenManCuaCon(a.choreId, a.dueDate, HOM_NAY, a.status));

  // Tap VE: dung cach man cua con dung chung — loc mot lan roi chia thanh nhom
  // bai (theo HW_SOURCES, gom theo ngay) va hai nhom nhiem vu.
  const veRa = dongTrenManCuaCon(fixture, HOM_NAY);
  const veTheoNhom = [
    ...nhomBaiTheoNoiGiao(veRa, Object.keys(HW_SOURCES) as HwSource[]).flatMap((g) => g.items),
    ...nhomNhiemVuHomNay(veRa, HOM_NAY, NHOMS).flatMap((g) => g.items),
  ];

  assert.deepEqual(ids(veTheoNhom), ids(demDuoc), 'moi dong duoc dem phai co mot cho de tick');
  assert.deepEqual(
    ids(demDuoc),
    ['bai_hom_nay', 'bai_hom_nay_xong', 'bai_hom_qua_no', 'nv_hom_nay_a', 'nv_hom_nay_cu', 'nv_hom_nay_h'],
    'bai hom nay + bai qua han CHUA xong + nhiem vu chi hom nay; bai qua han da xong, '
    + 'bai cua ngay mai/ngay kia (#62), nhiem vu cua hom qua va hai dong nhiem vu cua ngay mai bi loai'
  );

  // Phep thu ve-0: tick het moi thu man dang ve CUA HOM NAY thi con so con lai
  // dung bang so bai no cua ngay cu (1), khong con dong nao "treo".
  const conLai = demDuoc.filter((a) => !(a.status === 'done' || a.dueDate === HOM_NAY));
  assert.deepEqual(ids(conLai), ['bai_hom_qua_no']);
});

test('loc BAT KE status: dong nhiem vu ngay mai da done cung khong duoc dem', () => {
  const items = [
    dong({ id: 'nv_mai_todo', dueDate: NGAY_MAI }),
    dong({ id: 'nv_mai_done', dueDate: NGAY_MAI, status: 'done' }),
  ];
  assert.deepEqual(dongTrenManCuaCon(items, HOM_NAY), []);
});

/**
 * Tien do o dau nhom BAI TAP phai dem ca bai NO cua ngay cu — chinh nhung the ma
 * than nhom do dang ve duoi tieu de ngay cua no. Dem rieng hom nay thi con lam
 * xong hai bai hom nay la dau nhom to xanh + "🎉 2/2 bài xong" trong khi ngay
 * duoi con ba the chua lam, va cung luc huy hieu man chon ten doc "3 việc".
 * (Truoc #62 ca nay la bai cua NGAY MAI; gio bai ngay mai khong ve nen khong dem.)
 */
test('tien do nhom BAI TAP: con ba bai no cua ngay cu chua lam thi chua "xong het"', () => {
  const fixture = [
    dong({ id: 'hn1', dueDate: HOM_NAY, choreId: null, choreNhom: null, status: 'done' }),
    dong({ id: 'hn2', dueDate: HOM_NAY, choreId: null, choreNhom: null, status: 'done' }),
    dong({ id: 'hq1', dueDate: HOM_QUA, choreId: null, choreNhom: null }),
    dong({ id: 'hq2', dueDate: HOM_QUA, choreId: null, choreNhom: null }),
    dong({ id: 'hk1', dueDate: HOM_KIA, choreId: null, choreNhom: null }),
    dong({ id: 'nm1', dueDate: NGAY_MAI, choreId: null, choreNhom: null }),
  ];
  const veRa = dongTrenManCuaCon(fixture, HOM_NAY);
  const [nhomBai] = nhomBaiTheoNoiGiao(veRa, Object.keys(HW_SOURCES) as HwSource[]);

  assert.deepEqual(tienDoNhom(nhomBai.items), { total: 5, done: 2, xongHet: false });

  // Lam not ba bai no -> luc do moi "xong het" (bai ngay mai khong tham gia).
  const xongCa = veRa.map((a) => ({ ...a, status: 'done' as const }));
  const [nhomXong] = nhomBaiTheoNoiGiao(xongCa, Object.keys(HW_SOURCES) as HwSource[]);
  assert.deepEqual(tienDoNhom(nhomXong.items), { total: 5, done: 5, xongHet: true });
});

test('tien do nhom NHIEM VU chi tinh hom nay (than nhom cung chi ve hom nay)', () => {
  const fixture = [
    dong({ id: 'nv_hn', dueDate: HOM_NAY, choreNhom: 'housework', status: 'done' }),
    dong({ id: 'nv_nm', dueDate: NGAY_MAI, choreNhom: 'housework' }),
  ];
  const [nhom] = nhomNhiemVuHomNay(dongTrenManCuaCon(fixture, HOM_NAY), HOM_NAY, NHOMS);
  assert.deepEqual(
    tienDoNhom(nhom.items),
    { total: 1, done: 1, xongHet: true },
    'dong cua ngay mai khong duoc ve nen khong duoc dem'
  );
});

test('nhom bai theo noi giao: loai dong nhiem vu, giu thu tu, bo nhom rong', () => {
  const fixture = [
    dong({ id: 'ns1', dueDate: HOM_NAY, choreId: null, choreNhom: null, source: 'primary_school' }),
    dong({ id: 'ec1', dueDate: HOM_NAY, choreId: null, choreNhom: null, source: 'english_class' }),
    dong({ id: 'nv', dueDate: HOM_NAY, source: 'primary_school' }),
    dong({ id: 'ns2', dueDate: NGAY_MAI, choreId: null, choreNhom: null, source: 'primary_school' }),
  ];
  const nhoms = nhomBaiTheoNoiGiao(fixture, Object.keys(HW_SOURCES) as HwSource[]);
  assert.deepEqual(
    nhoms.map((g) => [g.source, g.items.map((a) => a.id)]),
    (Object.keys(HW_SOURCES) as HwSource[])
      .map((s) => [s, s === 'primary_school' ? ['ns1', 'ns2'] : s === 'english_class' ? ['ec1'] : []])
      .filter(([, ids]) => (ids as string[]).length > 0),
    'dong nhiem vu bi loai du source cua no la gi; nhom khong co bai thi khong hien'
  );
});


/* ---------------- issue #55: bai chua hoan thanh cua ngay da qua ---------------- */

test('#55: bai qua han CHUA xong van hien; bai qua han DA xong thi khong', () => {
  const items = [
    dong({ id: 'no_hom_qua', dueDate: HOM_QUA, choreId: null, choreNhom: null }),
    dong({ id: 'no_hom_kia', dueDate: HOM_KIA, choreId: null, choreNhom: null }),
    dong({ id: 'xong_hom_qua', dueDate: HOM_QUA, choreId: null, choreNhom: null, status: 'done' }),
    dong({ id: 'bai_hom_nay', dueDate: HOM_NAY, choreId: null, choreNhom: null }),
    dong({ id: 'xong_hom_nay', dueDate: HOM_NAY, choreId: null, choreNhom: null, status: 'done' }),
  ];

  assert.deepEqual(
    ids(dongTrenManCuaCon(items, HOM_NAY)),
    ['bai_hom_nay', 'no_hom_kia', 'no_hom_qua', 'xong_hom_nay'],
    'bai da xong cua ngay da qua khong duoc lan vao — hanh vi cu giu nguyen'
  );
});

test('#55: dong NHIEM VU cua ngay da qua KHONG hien, du con todo', () => {
  // Moi ngay sinh mot dong nhiem vu cho moi con: giu lai dong 'todo' cu la vai
  // nghin dong mot nam. Tick mot viec nha cua hom qua cung khong con nghia gi.
  const items = [
    dong({ id: 'nv_hom_qua', dueDate: HOM_QUA, choreNhom: 'housework' }),
    dong({ id: 'nv_hom_nay', dueDate: HOM_NAY, choreNhom: 'housework' }),
  ];
  assert.deepEqual(ids(dongTrenManCuaCon(items, HOM_NAY)), ['nv_hom_nay']);
});

test('#55: tien do nhom BAI TAP tinh ca bai no cua ngay cu (than nhom co ve ra)', () => {
  const fixture = [
    dong({ id: 'hn', dueDate: HOM_NAY, choreId: null, choreNhom: null, status: 'done' }),
    dong({ id: 'hq', dueDate: HOM_QUA, choreId: null, choreNhom: null }),
  ];
  const veRa = dongTrenManCuaCon(fixture, HOM_NAY);
  const [nhomBai] = nhomBaiTheoNoiGiao(veRa, Object.keys(HW_SOURCES) as HwSource[]);
  assert.deepEqual(
    tienDoNhom(nhomBai.items),
    { total: 2, done: 1, xongHet: false },
    'con mot bai no cua hom qua thi dau nhom chua duoc to xanh'
  );
});

test('#55: thu tu nhom ngay — hom nay tren cung, roi ngay cu lui dan', () => {
  // Chi con hom nay va ngay da qua (#62 bo ngay mai), nen "moi truoc" la du.
  const ngays = [HOM_KIA, HOM_QUA, HOM_NAY];
  assert.deepEqual(
    [...ngays].sort((a, b) => soSanhNgayTrenManCuaCon(a, b)),
    [HOM_NAY, HOM_QUA, HOM_KIA]
  );
});


/* ---------------- issue #62: khong ve bai cua ngay mai tro di ---------------- */

/**
 * Bon tinh huong cua luat bai tap sau #62, moi ca mot dong:
 *   hom qua chua xong -> HIEN (#55 giu nguyen)
 *   hom qua da xong   -> AN
 *   hom nay da xong   -> HIEN (gia dinh da chot voi captain: tick xong ma bai
 *                        bien mat la hong mach an mung)
 *   ngay mai chua xong -> AN (chinh ca ma #62 sinh ra)
 */
test('#62: bon tinh huong cua bai tap — hom qua no/xong, hom nay xong, ngay mai no', () => {
  assert.equal(veTrenManCuaCon(null, HOM_QUA, HOM_NAY, 'todo'), true, 'hom qua chua xong: hien');
  assert.equal(veTrenManCuaCon(null, HOM_QUA, HOM_NAY, 'done'), false, 'hom qua da xong: an');
  assert.equal(veTrenManCuaCon(null, HOM_NAY, HOM_NAY, 'done'), true, 'hom nay da xong: VAN hien');
  assert.equal(veTrenManCuaCon(null, NGAY_MAI, HOM_NAY, 'todo'), false, 'ngay mai chua xong: AN');
});

test('#62: bai tu ngay mai tro di khong ve, bat ke status; bai hom nay ve ca hai', () => {
  const NGAY_KIA = '2026-09-10';
  const items = [
    dong({ id: 'mai_todo', dueDate: NGAY_MAI, choreId: null, choreNhom: null }),
    dong({ id: 'mai_done', dueDate: NGAY_MAI, choreId: null, choreNhom: null, status: 'done' }),
    dong({ id: 'kia_todo', dueDate: NGAY_KIA, choreId: null, choreNhom: null }),
    dong({ id: 'nay_todo', dueDate: HOM_NAY, choreId: null, choreNhom: null }),
    dong({ id: 'nay_done', dueDate: HOM_NAY, choreId: null, choreNhom: null, status: 'done' }),
  ];
  assert.deepEqual(ids(dongTrenManCuaCon(items, HOM_NAY)), ['nay_done', 'nay_todo']);
});

test('#62: dong NHIEM VU giu nguyen — chi hom nay, ke ca sau khi bo bai ngay mai', () => {
  const items = [
    dong({ id: 'nv_qua', dueDate: HOM_QUA }),
    dong({ id: 'nv_nay', dueDate: HOM_NAY }),
    dong({ id: 'nv_nay_xong', dueDate: HOM_NAY, status: 'done' }),
    dong({ id: 'nv_mai', dueDate: NGAY_MAI }),
  ];
  assert.deepEqual(ids(dongTrenManCuaCon(items, HOM_NAY)), ['nv_nay', 'nv_nay_xong']);
});
