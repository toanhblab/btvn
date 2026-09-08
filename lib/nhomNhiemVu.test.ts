/**
 * Test cho `nhomNhiemVuHomNay` (lib/nhomNhiemVu.ts) — ham quyet dinh nhung dong
 * nhiem vu NAO duoc VE tren man cua con (app/con/[childId]/page.tsx).
 *
 * Vi sao co file nay: dong nhiem vu tick duoc la an sao ngay (issue #42, Q4/Q5).
 * Dong cua NGAY MAI van duoc tao san (saveSubmission goi taoNhiemVuNgay cho ngay
 * bo me giao bai), nen neu ve chung ra thi con bam "Đánh răng buổi tối" cua mai
 * tu toi nay: an sao truoc mot ngay, sang mai dong do da tick san, khong ai biet.
 * Bai TAP thi nguoc lai — bai ngay mai van phai hien.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nhomNhiemVuHomNay } from './nhomNhiemVu.ts';
import { NHOM_NHIEM_VU, type Assignment, type NhomNhiemVu } from './types.ts';

const HOM_NAY = '2026-09-08';
const NGAY_MAI = '2026-09-09';
const NHOMS = Object.keys(NHOM_NHIEM_VU) as NhomNhiemVu[];

/** Mot dong assignments toi gian — chi cac truong ham nay doc den la co nghia. */
function dong(p: {
  id: string; dueDate: string; choreId?: string | null; choreNhom?: NhomNhiemVu | null;
  status?: 'todo' | 'done';
}): Assignment {
  return {
    id: p.id, submissionId: null, childId: 'con', subject: 'Việc nhà', icon: '🧹',
    content: p.id, note: null, lang: 'vi', dueDate: p.dueDate, source: 'primary_school',
    status: p.status ?? 'todo', completedAt: null, imageUrl: null, media: [],
    durationMinutes: 10, requiresVideo: false, submittedVideoUrl: null, submittedVideoAt: null,
    choreId: p.choreId === undefined ? 'chr' : p.choreId,
    startedAt: null, stars: 1, choreNhom: p.choreNhom === undefined ? 'after_study' : p.choreNhom,
  };
}

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
