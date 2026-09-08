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
 *      mai dong do da tick san. Bai TAP thi nguoc lai — bai ngay mai van hien.
 *   2. Bat bien "tap DEM == tap VE" (AGENTS.md): con so tom tat (huy hieu
 *      "N viec" o man chon ten, hai o cua bo me) chi duoc dem nhung dong man cua
 *      con VE RA va cho TICK. Test cuoi file ghim dung dieu do tren mot fixture.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dongTrenManCuaCon, nhomBaiTheoNoiGiao, nhomNhiemVuHomNay, tienDoNhom, veTrenManCuaCon,
} from './nhomNhiemVu.ts';
import { HW_SOURCES, NHOM_NHIEM_VU, type Assignment, type HwSource, type NhomNhiemVu } from './types.ts';

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
    dong({ id: 'nv_hom_nay_a', dueDate: HOM_NAY, choreNhom: 'after_study' }),
    dong({ id: 'nv_hom_nay_h', dueDate: HOM_NAY, choreNhom: 'housework', status: 'done' }),
    dong({ id: 'nv_hom_nay_cu', dueDate: HOM_NAY, choreNhom: null }),
    dong({ id: 'nv_ngay_mai', dueDate: NGAY_MAI, choreNhom: 'housework' }),
    dong({ id: 'nv_ngay_mai_xong', dueDate: NGAY_MAI, choreNhom: 'after_study', status: 'done' }),
  ];

  // Tap DEM: dung buoc loc `upcoming` cua progressUpcoming (lib/store.ts) —
  // cung ham nay, tren du lieu dang {choreId, dueDate}.
  const demDuoc = fixture.filter((a) => veTrenManCuaCon(a.choreId, a.dueDate, HOM_NAY));

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
    ['bai_hom_nay', 'bai_hom_nay_xong', 'bai_ngay_kia', 'bai_ngay_mai',
     'nv_hom_nay_a', 'nv_hom_nay_cu', 'nv_hom_nay_h'],
    'bai tu hom nay tro di + nhiem vu chi hom nay; hai dong nhiem vu cua ngay mai bi loai'
  );

  // Phep thu ve-0: tick het moi thu man dang ve CUA HOM NAY thi con so con lai
  // dung bang so bai cua ngay khac (2), khong con dong nhiem vu nao "treo".
  const conLai = demDuoc.filter((a) => !(a.status === 'done' || a.dueDate === HOM_NAY));
  assert.deepEqual(ids(conLai), ['bai_ngay_kia', 'bai_ngay_mai']);
});

test('loc BAT KE status: dong nhiem vu ngay mai da done cung khong duoc dem', () => {
  const items = [
    dong({ id: 'nv_mai_todo', dueDate: NGAY_MAI }),
    dong({ id: 'nv_mai_done', dueDate: NGAY_MAI, status: 'done' }),
  ];
  assert.deepEqual(dongTrenManCuaCon(items, HOM_NAY), []);
});

/**
 * Tien do o dau nhom BAI TAP phai dem ca bai cua NGAY MAI — chinh nhung the ma
 * than nhom do dang ve duoi tieu de "Ngày mai". Dem rieng hom nay thi con lam
 * xong hai bai hom nay la dau nhom to xanh + "🎉 2/2 bài xong" trong khi ngay
 * duoi con ba the chua lam, va cung luc huy hieu man chon ten doc "3 việc".
 */
test('tien do nhom BAI TAP: con ba bai ngay mai chua lam thi chua "xong het"', () => {
  const fixture = [
    dong({ id: 'hn1', dueDate: HOM_NAY, choreId: null, choreNhom: null, status: 'done' }),
    dong({ id: 'hn2', dueDate: HOM_NAY, choreId: null, choreNhom: null, status: 'done' }),
    dong({ id: 'nm1', dueDate: NGAY_MAI, choreId: null, choreNhom: null }),
    dong({ id: 'nm2', dueDate: NGAY_MAI, choreId: null, choreNhom: null }),
    dong({ id: 'nm3', dueDate: NGAY_MAI, choreId: null, choreNhom: null }),
  ];
  const veRa = dongTrenManCuaCon(fixture, HOM_NAY);
  const [nhomBai] = nhomBaiTheoNoiGiao(veRa, Object.keys(HW_SOURCES) as HwSource[]);

  assert.deepEqual(tienDoNhom(nhomBai.items), { total: 5, done: 2, xongHet: false });

  // Lam not ba bai ngay mai -> luc do moi "xong het".
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
