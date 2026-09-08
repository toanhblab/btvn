/**
 * Link /nha/<slug> — bay may sang mot nha (issue #46 dung no de di demo ba nha
 * 1111/2222/3333, README ghi ba link).
 *
 * Loi da co: link chi doi cookie THIET BI, ma `viewingFamilyId` uu tien phien BO
 * ME, nen dang co phien nha A ma mo link nha B thi man cua con van hien nha A —
 * va man nhap PIN tu chuyen huong di khi da co phien, nut "Quen PIN tren thiet bi
 * nay" thi da bo (issue #17), nen khong con duong nao doi nha trong app.
 *
 * Chay THAT: goi chinh GET cua app/nha/[slug]/route.ts tren PGlite trong RAM, doc
 * Set-Cookie cua response tra ve. `next/headers` duoc thay bang mot hu cookie gia
 * (route handler that lay cookie cua request qua do).
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
const { signIn } = await import('./auth.ts');
const { insertFamily } = await import('./store.ts');
const { GET } = await import('../app/nha/[slug]/route.ts');

let nhaA: { id: string; slug: string };
let nhaB: { id: string; slug: string };

before(async () => {
  await chayMigrations({
    ten: 'PGlite',
    query: (t: string, p: unknown[] = []) => query(t, p),
    chayGoi: async (cau: { sql: string; params?: unknown[] }[]) => { await queryTx(cau); },
  });
  nhaA = await insertFamily('Nha A', 'hash-a');
  nhaB = await insertFamily('Nha B', 'hash-b');
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
  await signIn(nhaA.id, true);
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
  await signIn(nhaA.id, true);
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
  await signIn(nhaA.id, true);
  const { res, dat } = await moLink('khong-co-that');
  assert.equal(res.headers.get('location'), 'http://localhost/vao?loi=link');
  assert.equal(dat.size, 0);
});
