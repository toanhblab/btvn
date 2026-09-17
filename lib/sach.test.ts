/**
 * Sach / vo / nguon bai tap cua cac con (issue #64, migration 021) — chay THAT
 * tren PGlite trong RAM qua CHINH lib/store.ts va cac route handler (khong mo
 * phong lai SQL; scripts/test-hook.mjs cho node resolve import khong duoi,
 * BTVN_PGLITE_DIR=memory:// de khong dung vao ./.data/pg). `next/headers` duoc
 * thay bang mot hu cookie gia, cung khuon lib/nha-link.test.ts.
 *
 * Nhung dieu de vo ma khong ai thay, kiem o day:
 *   1. Migration 021 tao bang va chay lai duoc.
 *   2. MOI truy van loc theo nha: nha B khong thay, khong sua, khong bo duoc sach
 *      cua nha A — ca qua store lan qua route (404).
 *   3. Loc theo con (listBooks childIds): sach ca nha luon co, sach rieng chi khi
 *      giao cho mot trong cac con dang hoi. Day la duong /api/extract dung de
 *      sach cua be mau giao khong lot vao bai cua hai be lop 1.
 *   4. Bo la DANH DAU (archived_at): bien khoi moi duong doc, dong van con.
 *   5. Xoa mot con thi id do bien khoi books.child_ids (cung bat bien voi
 *      daily_chores) — khong thi hang "Sach cua" khong sua duoc nua.
 *   6. Route: can PIN (401), chan ten trung / ten dai / con nha khac / than khong
 *      phai object (400).
 *   7. HOI QUY bat buoc (firstmate): nha CHUA khai sach nao thi /api/extract tra
 *      ve dung ket qua cua splitByRule(text) khong sach — y nhu truoc; nha da
 *      khai thi ban tach nhan ten sach va gop; va childIds quyet dinh sach nao
 *      duoc dung.
 */

import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.BTVN_PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
delete process.env.DATABASE_URL_UNPOOLED; delete process.env.POSTGRES_URL_NON_POOLING;
// Khong co key -> /api/extract di duong tach tho (splitByRule), khong goi mang
delete process.env.NOUS_API_KEY;

/** Cookie trinh duyet dang GUI LEN trong request dang xu ly. */
const hu = new Map<string, string>();

mock.module('next/headers', {
  namedExports: {
    cookies: async () => ({
      get: (ten: string) => (hu.has(ten) ? { name: ten, value: hu.get(ten)! } : undefined),
      set: (ten: string, giaTri: string) => { hu.set(ten, giaTri); },
      delete: (ten: string) => { hu.delete(ten); },
    }),
  },
});

const { chayMigrations } = await import('../scripts/db.mjs');
const { query, queryTx } = await import('./db.ts');
const { signIn, hashPin } = await import('./auth.ts');
const store = await import('./store.ts');
const { splitByRule } = await import('./ai.ts');
const { T_VI } = await import('./i18n/chu.ts');
const sachRoute = await import('../app/api/sach/route.ts');
const sachIdRoute = await import('../app/api/sach/[id]/route.ts');
const extractRoute = await import('../app/api/extract/route.ts');

const TEP_021 = '021_sach_cua_nha.sql';
const rows = (sql: string, p: unknown[] = []) => query<Record<string, unknown>>(sql, p);
const boChay = {
  ten: 'PGlite',
  query: rows,
  chayGoi: async (cau: { sql: string; params?: unknown[] }[]) => { await queryTx(cau); },
};

let nhaA: { id: string };
let nhaB: { id: string };
const PIN_A = '4321';
const PIN_B = '8765';

before(async () => {
  await chayMigrations(boChay);
  nhaA = await store.insertFamily('Nhà A', await hashPin(PIN_A));
  nhaB = await store.insertFamily('Nhà B', await hashPin(PIN_B));
  for (const [id, fam, name, grade, i] of [
    ['minh', nhaA.id, 'Minh', 'Lớp 1', 1], ['an', nhaA.id, 'An', 'Lớp 1', 2], ['na', nhaA.id, 'Na', 'Mẫu giáo', 3],
    ['bob', nhaB.id, 'Bob', 'Lớp 2', 1],
  ] as const) {
    await query(
      `INSERT INTO children (id, family_id, name, avatar_url, color, grade, sort_order)
       VALUES ($1, $2, $3, '/img/x.jpg', 'primary', $4, $5)`,
      [id, fam, name, grade, i]);
  }
});

beforeEach(() => hu.clear());

const json = (body: unknown) =>
  new Request('http://localhost/api/x', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test('021: bang books ton tai, migration chay lai duoc', async () => {
  const [{ n }] = await rows(`SELECT COUNT(*) AS n FROM _migrations WHERE name = $1`, [TEP_021]);
  assert.equal(Number(n), 1);
  await rows(`DELETE FROM _migrations WHERE name = $1`, [TEP_021]);
  await chayMigrations(boChay);
  const [{ n: n2 }] = await rows(`SELECT COUNT(*) AS n FROM _migrations WHERE name = $1`, [TEP_021]);
  assert.equal(Number(n2), 1);
});

test('CRUD theo nha: nha B khong thay / khong sua / khong bo duoc sach cua nha A', async () => {
  const poth = await store.createBook(nhaA.id, { name: 'Poth Math', subject: 'Toán', childIds: null });
  assert.equal(poth.subject, 'Toán');
  assert.equal(poth.childIds, null);
  assert.deepEqual((await store.listBooks(nhaA.id)).map((b) => b.id), [poth.id]);

  assert.deepEqual(await store.listBooks(nhaB.id), []);
  assert.equal(await store.getBook(nhaB.id, poth.id), null);
  assert.equal(await store.updateBook(nhaB.id, poth.id, { name: 'Hack' }), null);
  await store.deleteBook(nhaB.id, poth.id);
  assert.equal((await store.getBook(nhaA.id, poth.id))?.name, 'Poth Math', 'nha B khong bo duoc sach nha A');

  // Sua that
  const sua = await store.updateBook(nhaA.id, poth.id, { subject: null, childIds: ['minh', 'an'] });
  assert.equal(sua?.subject, null);
  assert.deepEqual(sua?.childIds, ['minh', 'an']);
  await store.updateBook(nhaA.id, poth.id, { subject: 'Toán' });
});

test('listBooks theo con: sach ca nha luon co, sach rieng chi khi giao cho mot trong cac con dang hoi', async () => {
  const chung = await store.createBook(nhaA.id, { name: 'Vở ô ly', subject: null, childIds: null });
  const cuaNa = await store.createBook(nhaA.id, { name: 'Bé tập tô', subject: 'Vẽ', childIds: ['na'] });
  const [poth] = (await store.listBooks(nhaA.id)).filter((b) => b.name === 'Poth Math');   // minh + an

  const ten = (ds: { name: string }[]) => ds.map((b) => b.name).sort();
  assert.deepEqual(ten(await store.listBooks(nhaA.id)), ['Bé tập tô', 'Poth Math', 'Vở ô ly'], 'khong loc = tat ca');
  assert.deepEqual(ten(await store.listBooks(nhaA.id, { childIds: [] })), ['Bé tập tô', 'Poth Math', 'Vở ô ly'], 'mang rong = tat ca');
  assert.deepEqual(ten(await store.listBooks(nhaA.id, { childIds: ['minh'] })), ['Poth Math', 'Vở ô ly']);
  assert.deepEqual(ten(await store.listBooks(nhaA.id, { childIds: ['na'] })), ['Bé tập tô', 'Vở ô ly']);
  assert.deepEqual(ten(await store.listBooks(nhaA.id, { childIds: ['minh', 'na'] })), ['Bé tập tô', 'Poth Math', 'Vở ô ly']);
  assert.deepEqual(ten(await store.listBooks(nhaA.id, { childIds: ['bob'] })), ['Vở ô ly'], 'con nha khac: chi con sach ca nha');
  assert.ok(chung.id && cuaNa.id && poth.id);
});

test('bo sach = danh dau archived_at: bien khoi list/get/update, dong van con', async () => {
  const tam = await store.createBook(nhaA.id, { name: 'Sách tạm', subject: null, childIds: null });
  await store.deleteBook(nhaA.id, tam.id);
  assert.equal(await store.getBook(nhaA.id, tam.id), null);
  assert.ok(!(await store.listBooks(nhaA.id)).some((b) => b.id === tam.id));
  assert.equal(await store.updateBook(nhaA.id, tam.id, { name: 'Sống lại' }), null);
  const [dong] = await rows(`SELECT name, archived_at FROM books WHERE id = $1`, [tam.id]);
  assert.equal(dong.name, 'Sách tạm', 'dong con, ten khong doi');
  assert.ok(dong.archived_at, 'co moc da bo');
  // Bo roi thi khai lai cung ten duoc (ten trung chi xet cuon dang dung)
  assert.equal(await store.bookTrungTen(nhaA.id, 'Sách tạm'), false);
});

test('bookTrungTen: khong phan biet hoa/thuong va khoang trang thua; exceptId cho doi ten chinh no', async () => {
  const [poth] = (await store.listBooks(nhaA.id)).filter((b) => b.name === 'Poth Math');
  assert.equal(await store.bookTrungTen(nhaA.id, 'poth  math'), true);
  assert.equal(await store.bookTrungTen(nhaA.id, 'POTH MATH', poth.id), false, 'doi ten chinh no');
  assert.equal(await store.bookTrungTen(nhaA.id, 'Poth Math 2'), false);
  assert.equal(await store.bookTrungTen(nhaB.id, 'Poth Math'), false, 'nha khac khong tinh');
});

test('xoa mot con: id do bien khoi books.child_ids; mang rong con lai = chua giao ai', async () => {
  await query(`INSERT INTO children (id, family_id, name, avatar_url, color, grade, sort_order)
               VALUES ('tam', $1, 'Tạm', '/img/x.jpg', 'tertiary', 'Lớp 3', 9)`, [nhaA.id]);
  const rieng = await store.createBook(nhaA.id, { name: 'Sách của Tạm', subject: null, childIds: ['tam'] });
  const chungVoiMinh = await store.createBook(nhaA.id, { name: 'Sách Tạm và Minh', subject: null, childIds: ['tam', 'minh'] });
  await store.deleteChild(nhaA.id, 'tam');
  assert.deepEqual((await store.getBook(nhaA.id, rieng.id))?.childIds, [], 'mang rong, KHONG ve null (ca nha)');
  assert.deepEqual((await store.getBook(nhaA.id, chungVoiMinh.id))?.childIds, ['minh']);
  // Don de cac bai sau khong vuong
  await store.deleteBook(nhaA.id, rieng.id);
  await store.deleteBook(nhaA.id, chungVoiMinh.id);
});

test('route /api/sach: can PIN; them / trung ten / ten dai / con nha khac; PATCH + DELETE loc theo nha', async () => {
  // Chua PIN
  assert.equal((await sachRoute.GET()).status, 401);
  assert.equal((await sachRoute.POST(json({ name: 'X' }))).status, 401);

  await signIn(nhaA.id, true, PIN_A);
  const ok = await sachRoute.POST(json({ name: '  Tiếng   Việt tập 1 ', subject: 'Tiếng Việt', childIds: ['minh', 'an'] }));
  assert.equal(ok.status, 200);
  const { book } = await ok.json();
  assert.equal(book.name, 'Tiếng Việt tập 1', 'gom khoang trang');
  assert.equal(book.subject, 'Tiếng Việt');
  assert.deepEqual(book.childIds, ['minh', 'an']);

  assert.equal((await sachRoute.POST(json({ name: 'tiếng việt tập 1' }))).status, 400, 'trung ten');
  assert.equal((await sachRoute.POST(json({ name: 'A'.repeat(61) }))).status, 400, 'ten dai');
  assert.equal((await sachRoute.POST(json({ name: '' }))).status, 400, 'ten trong');
  assert.equal((await sachRoute.POST(json({ name: 'Sách lạ', childIds: ['bob'] }))).status, 400, 'con nha khac');
  assert.equal((await sachRoute.POST(json({ name: 'Sách lạ', childIds: [] }))).status, 400, 'mang rong');
  const la = await (await sachRoute.POST(json({ name: 'Sách môn lạ', subject: 'Nhạc' }))).json();
  assert.equal(la.book.subject, null, 'mon khong co trong SUBJECTS -> chua ro mon');

  const danhSach = await (await sachRoute.GET()).json();
  assert.ok(danhSach.books.some((b: { id: string }) => b.id === book.id));

  // PATCH: doi ten trung cuon khac -> 400; doi thanh chinh ten no (khac hoa/thuong) -> ok
  assert.equal((await sachIdRoute.PATCH(json({ name: 'Poth Math' }), ctx(book.id))).status, 400);
  // Than khong phai object (so / chuoi / mang): 400 chu khong nga vi `'subject' in body`
  for (const la of [5, 'x', ['name'], null]) {
    assert.equal((await sachIdRoute.PATCH(json(la), ctx(book.id))).status, 400, `than la ${JSON.stringify(la)}`);
  }
  // name khong phai chuoi: 400 chu KHONG ep kieu (khong doi ten thanh 'null' / '5')
  for (const la of [null, 5, {}, []]) {
    assert.equal(
      (await sachIdRoute.PATCH(json({ name: la }), ctx(book.id))).status, 400,
      `name la ${JSON.stringify(la)}`);
    assert.equal((await store.getBook(nhaA.id, book.id))?.name, book.name, 'ten giu nguyen');
  }
  const doi = await sachIdRoute.PATCH(json({ name: 'TIẾNG VIỆT TẬP 1', subject: null, childIds: null }), ctx(book.id));
  assert.equal(doi.status, 200);
  const sauDoi = (await doi.json()).book;
  assert.equal(sauDoi.name, 'TIẾNG VIỆT TẬP 1');
  assert.equal(sauDoi.subject, null);
  assert.equal(sauDoi.childIds, null);

  // Nha B khong dong vao duoc
  hu.clear();
  await signIn(nhaB.id, true, PIN_B);
  assert.equal((await sachIdRoute.PATCH(json({ name: 'Hack' }), ctx(book.id))).status, 404);
  assert.equal((await sachIdRoute.DELETE(json({}), ctx(book.id))).status, 404);
  assert.equal((await (await sachRoute.GET()).json()).books.length, 0);

  // Nha A bo -> bien
  hu.clear();
  await signIn(nhaA.id, true, PIN_A);
  assert.equal((await sachIdRoute.DELETE(json({}), ctx(book.id))).status, 200);
  assert.equal((await sachIdRoute.DELETE(json({}), ctx(book.id))).status, 404, 'bo lan hai: khong con');
  assert.equal(await store.getBook(nhaA.id, book.id), null);
  await sachIdRoute.DELETE(json({}), ctx(la.book.id));
});

test('/api/extract: nha CHUA khai sach -> y nhu splitByRule(text) cu; nha da khai -> nhan ten sach va gop; childIds quyet dinh sach nao', async () => {
  const text = 'Poth Math tr. 41\npoth math trang 42';

  assert.equal((await extractRoute.POST(json({ text }))).status, 401, 'can PIN');

  // Nha B: khong co sach -> ket qua = splitByRule khong sach (hai dong "Khác", khong gop)
  await signIn(nhaB.id, true, PIN_B);
  const b = await (await extractRoute.POST(json({ text, childIds: ['bob'] }))).json();
  assert.equal(b.source, 'rule');
  assert.deepEqual(b.drafts, splitByRule(text, T_VI), 'nha chua khai sach: y nhu truoc');
  assert.equal(b.drafts.length, 2);

  // Nha A, giao cho Minh (Poth Math la sach cua minh + an) -> gop lai mot bai, dung mon
  hu.clear();
  await signIn(nhaA.id, true, PIN_A);
  const a = await (await extractRoute.POST(json({ text, childIds: ['minh'] }))).json();
  assert.equal(a.drafts.length, 1);
  assert.equal(a.drafts[0].note, 'Poth Math');
  assert.equal(a.drafts[0].subject, 'Toán');
  assert.equal(a.drafts[0].content, 'Poth Math tr. 41; poth math trang 42');

  // Giao cho Na: Poth Math khong phai sach cua Na -> khong nhan, hai bai nhu cu
  const na = await (await extractRoute.POST(json({ text, childIds: ['na'] }))).json();
  assert.equal(na.drafts.length, 2);
  assert.deepEqual(na.drafts, splitByRule(text, T_VI));

  // Khong gui childIds -> sach ca nha (Poth Math cua minh+an van duoc tinh la cua nha)
  const tatCa = await (await extractRoute.POST(json({ text }))).json();
  assert.equal(tatCa.drafts.length, 1);
});
