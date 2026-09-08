/**
 * Link /nha/<slug> — bay may sang mot nha (issue #46 dung no de di demo ba nha
 * 1111/2222/3333, README ghi ba link).
 *
 * Loi da co: link chi doi cookie THIET BI, ma `viewingFamilyId` uu tien phien BO
 * ME, nen dang co phien nha A ma mo link nha B thi man cua con van hien nha A —
 * va man nhap PIN tu chuyen huong di khi da co phien, nut "Quen PIN tren thiet bi
 * nay" thi da bo (issue #17), nen khong con duong nao doi nha trong app.
 *
 * HAI duong gan may vao mot nha, cung mot luat (nam trong lib/auth.ts, khong o
 * tung route): link /nha/<slug>, va POST /api/nha o man "Day la may cua nha nao?".
 * Ca hai deu duoc kiem o day — bo sot mot duong la con nguyen ngo cut.
 *
 * Chay THAT: goi chinh GET/POST cua hai route tren PGlite trong RAM, doc cookie
 * chung dat. `next/headers` duoc thay bang mot hu cookie gia (route handler that
 * lay cookie cua request qua do).
 */

import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.BTVN_PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
delete process.env.DATABASE_URL_UNPOOLED; delete process.env.POSTGRES_URL_NON_POOLING;

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
const { signIn, hashPin, viewingFamilyId } = await import('./auth.ts');
const { insertFamily } = await import('./store.ts');
const { GET } = await import('../app/nha/[slug]/route.ts');
const { POST } = await import('../app/api/nha/route.ts');

const PIN_A = '4321';
const PIN_B = '5678';

let nhaA: { id: string; slug: string };
let nhaB: { id: string; slug: string };
let nhaDemo: { id: string; slug: string };

before(async () => {
  await chayMigrations({
    ten: 'PGlite',
    query: (t: string, p: unknown[] = []) => query(t, p),
    chayGoi: async (cau: { sql: string; params?: unknown[] }[]) => { await queryTx(cau); },
  });
  nhaA = await insertFamily('Nha A', await hashPin(PIN_A));
  nhaB = await insertFamily('Nha B', await hashPin(PIN_B));
  nhaDemo = await insertFamily('Nha demo ja', await hashPin('1111'));
});

beforeEach(() => hu.clear());

/** Mo link /nha/<slug> nhu trinh duyet: tra ve cac cookie response dat lai. */
async function moLink(slug: string) {
  const res = await GET(new Request(`http://localhost/nha/${slug}`), {
    params: Promise.resolve({ slug }),
  });
  const dat = new Map<string, { value: string; maxAge?: number }>();
  for (const c of res.cookies.getAll()) dat.set(c.name, { value: c.value, maxAge: c.maxAge });
  return { res, dat };
}

test('mo link cua NHA KHAC: may sang nha moi va phien bo me cu bi go', async () => {
  await signIn(nhaA.id, true, PIN_A);
  const phienA = hu.get('btvn_parent')!;
  assert.ok(phienA, 'da co phien bo me nha A');

  const { res, dat } = await moLink(nhaB.slug);
  assert.equal(res.headers.get('location'), 'http://localhost/con');

  const thietBi = dat.get('btvn_nha');
  assert.ok(thietBi?.value.startsWith(`${nhaB.id}.`), `may phai sang nha B, dang la ${thietBi?.value}`);

  const boMe = dat.get('btvn_parent');
  assert.ok(boMe, 'phai co Set-Cookie go phien bo me');
  assert.equal(boMe!.value, '');
  assert.equal(boMe!.maxAge, 0, 'go bang Max-Age=0 nen trinh duyet xoa ngay');
});

test('mo lai link CHINH NHA MINH: giu nguyen phien bo me', async () => {
  await signIn(nhaA.id, true, PIN_A);
  const phienA = hu.get('btvn_parent')!;

  const { dat } = await moLink(nhaA.slug);
  assert.equal(dat.get('btvn_parent'), undefined, 'khong duoc dung toi phien bo me cua chinh nha do');
  assert.equal(dat.get('btvn_nha')!.value, phienA, 'may van gan vao nha A');
});

test('chua nhap PIN: chi gan may vao nha, khong dat cookie bo me', async () => {
  const { dat } = await moLink(nhaB.slug);
  assert.equal(dat.get('btvn_parent'), undefined);
  assert.ok(dat.get('btvn_nha')!.value.startsWith(`${nhaB.id}.`));
});

test('slug khong co nha nao: ve man chon nha, khong dung cookie', async () => {
  await signIn(nhaA.id, true, PIN_A);
  const { res, dat } = await moLink('khong-co-that');
  assert.equal(res.headers.get('location'), 'http://localhost/vao?loi=link');
  assert.equal(dat.size, 0);
});

/** Nhap PIN o man "Day la may cua nha nao?" — duong gan may thu hai. */
async function nhapPinGanMay(pin: string) {
  const res = await POST(new Request('http://localhost/api/nha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `test-${pin}` },
    body: JSON.stringify({ pin }),
  }));
  return { res, than: await res.json() };
}

test('POST /api/nha voi PIN cua NHA KHAC: may sang nha moi va phien bo me cu bi go', async () => {
  await signIn(nhaA.id, true, PIN_A);
  assert.ok(hu.get('btvn_parent'), 'da co phien bo me nha A');

  const { res } = await nhapPinGanMay(PIN_B);
  assert.equal(res.status, 200);
  assert.ok(hu.get('btvn_nha')!.startsWith(`${nhaB.id}.`), 'may phai sang nha B');
  assert.equal(hu.get('btvn_parent'), undefined, 'phien bo me nha A phai bi go');
});

test('POST /api/nha voi PIN CHINH NHA MINH: giu nguyen phien bo me', async () => {
  await signIn(nhaA.id, true, PIN_A);
  const phienA = hu.get('btvn_parent')!;

  await nhapPinGanMay(PIN_A);
  assert.equal(hu.get('btvn_parent'), phienA, 'khong duoc dung toi phien cua chinh nha do');
  assert.ok(hu.get('btvn_nha')!.startsWith(`${nhaA.id}.`));
});

test('POST /api/nha khi chua nhap PIN bo me: chi gan may, khong tao phien', async () => {
  await nhapPinGanMay(PIN_B);
  assert.equal(hu.get('btvn_parent'), undefined);
  assert.ok(hu.get('btvn_nha')!.startsWith(`${nhaB.id}.`));
});

/**
 * PIN demo (1111/2222/3333) ai cung biet, va captain nhap chung ngay tren may cua
 * minh de demo cho khach. Gan may la gan MOT NAM, nen neu nhap PIN demo cung gan
 * may thi het phien bo me la man cua con hien nha demo tieng Nhat — tren may nha
 * minh. Nhap PIN demo chi duoc mo PHIEN.
 */
test('PIN demo: chi mo phien bo me, KHONG gan may vao nha demo', async () => {
  await signIn(nhaA.id, false, PIN_A);
  const mayCuaNhaA = hu.get('btvn_nha')!;
  assert.ok(mayCuaNhaA.startsWith(`${nhaA.id}.`), 'may dang gan vao nha that A');

  await signIn(nhaDemo.id, false, '1111');
  assert.ok(hu.get('btvn_parent')!.startsWith(`${nhaDemo.id}.`), 'phien bo me la nha demo');
  assert.equal(hu.get('btvn_nha'), mayCuaNhaA, 'may KHONG duoc gan sang nha demo');

  // Dong trinh duyet: cookie phien het, cookie may con nguyen mot nam
  hu.delete('btvn_parent');
  assert.equal(await viewingFamilyId(), nhaA.id, 'het phien thi ve lai nha that');
});

test('POST /api/nha voi PIN demo: tu choi, KHONG gan may vao nha demo', async () => {
  await nhapPinGanMay(PIN_A);
  const mayCuaNhaA = hu.get('btvn_nha')!;

  const { res, than } = await nhapPinGanMay('1111');
  assert.equal(res.status, 400, 'man "Day la may cua nha nao?" tu choi PIN demo');
  assert.ok(than.error, 'co cau bao cho bo me doc');
  assert.equal(hu.get('btvn_nha'), mayCuaNhaA, 'may van la cua nha that');
});

test('PIN that: van gan may vao nha do nhu cu', async () => {
  await signIn(nhaA.id, false, PIN_A);
  assert.ok(hu.get('btvn_nha')!.startsWith(`${nhaA.id}.`));

  await signIn(nhaB.id, false, PIN_B);
  assert.ok(hu.get('btvn_nha')!.startsWith(`${nhaB.id}.`), 'PIN that doi ca may sang nha B');
  assert.ok(hu.get('btvn_parent')!.startsWith(`${nhaB.id}.`), 'phien khong bi chinh no go');
});
