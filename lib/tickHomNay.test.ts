/**
 * Test cho so dem "hom nay con bao nhieu viec" cua man bai cua con
 * (lib/tickHomNay.ts).
 *
 * Vi sao co file nay: tu issue #42 man cua con dung HAI nhom nhiem vu ("Sau khi
 * hoc xong" va "Viec nha hang ngay"), moi nhom la mot <ViecNhaBai> voi tick lac
 * quan rieng. Truoc khi co ham thuan nay, moi nhom tu tru tick cua CHINH no vao
 * so cua may chu nen khong thay tick cua nhom kia: con tick het nhom A roi tick
 * ngay nhom B (truoc khi router.refresh() cua nhom A kip ve) thi nhom B tinh
 * ra van con viec, va con KHONG bao gio duoc day sang man khen /xong.
 *
 * app/con/[childId]/TickHomNay.tsx giu map tick dung chung cho ca hai nhom va
 * goi dung ham nay de dem, nen kich ban duoi day chay dung thu tu ma hai nhom
 * goi vao map do.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conLaiHomNay, type MocHomNay, type TickLacQuan } from './tickHomNay.ts';

/** Du lieu that cua Be Na (seed): 0 bai that, 3 viec nhom A, 1 viec nhom B. */
const NHOM_A = ['a1', 'a2', 'a3'];
const NHOM_B = ['b1'];
const MOC_CHUA_TICK: MocHomNay = Object.fromEntries(
  [...NHOM_A, ...NHOM_B].map((id) => [id, false])
);

test('tick het nhom A roi tick ngay nhom B: dong cuoi cung phai ra 0 (day sang man khen)', () => {
  // May chu chua thay gi (router.refresh() cua nhom A chua kip ve), nen ca hai
  // nhom deu dang doc CUNG mot moc: 4 dong 'todo'.
  const daTick: TickLacQuan = {};
  const conLai: number[] = [];

  for (const id of [...NHOM_A, ...NHOM_B]) {
    daTick[id] = true;
    conLai.push(conLaiHomNay(4, MOC_CHUA_TICK, daTick));
  }

  assert.deepEqual(
    conLai,
    [3, 2, 1, 0],
    'ba cu tick dau con viec nen khong duoc day man khen; cu tick thu tu (nhom B) phai ra 0'
  );
});

test('nguoc thu tu (nhom B truoc, nhom A sau) cung ra 0 o cu tick cuoi', () => {
  const daTick: TickLacQuan = {};
  const conLai: number[] = [];

  for (const id of [...NHOM_B, ...NHOM_A]) {
    daTick[id] = true;
    conLai.push(conLaiHomNay(4, MOC_CHUA_TICK, daTick));
  }

  assert.deepEqual(conLai, [3, 2, 1, 0]);
});

test('router.refresh() cua nhom A ve giua duong: khong tru hai lan', () => {
  // Sau khi lam moi, may chu da thay 3 dong nhom A la 'done' (todoHomNay = 1)
  // nhung map tick lac quan van con nguyen ba entry do — moc moi va todoHomNay
  // moi luon di cung nhau, nen phep cong tru phai ra dung 1, roi 0.
  const mocSauRefresh: MocHomNay = { a1: true, a2: true, a3: true, b1: false };
  const daTick: TickLacQuan = { a1: true, a2: true, a3: true };

  assert.equal(conLaiHomNay(1, mocSauRefresh, daTick), 1, 'con dong nhom B chua tick');

  daTick.b1 = true;
  assert.equal(conLaiHomNay(1, mocSauRefresh, daTick), 0);
});

test('bo tick mot dong may chu da thay la xong: so viec con lai tang len', () => {
  const moc: MocHomNay = { a1: true, a2: true, a3: true, b1: true };

  assert.equal(conLaiHomNay(0, moc, {}), 0, 'chua dung den dong nao thi giu so cua may chu');
  assert.equal(conLaiHomNay(0, moc, { a2: false }), 1, 'bo tick mot dong -> con 1 viec');
  const tickLai: TickLacQuan = { a2: false };
  tickLai.a2 = true;
  assert.equal(conLaiHomNay(0, moc, tickLai), 0, 'tick lai dong do -> ve dung so cua may chu');
});

test('tick dong cua NGAY MAI khong lam thay doi so viec cua hom nay', () => {
  // Nhom nhiem vu cua ngay mai cung hien tren man nay (bo me da giao bai ngay
  // mai). Dong do khong co trong moc cua hom nay nen phai bi bo qua — khong thi
  // con tick truoc viec cua ngay mai la bi day sang man khen som.
  assert.equal(conLaiHomNay(4, MOC_CHUA_TICK, { mai1: true }), 4);
  assert.equal(
    conLaiHomNay(4, MOC_CHUA_TICK, { a1: true, a2: true, a3: true, mai1: true }),
    1,
    'chi ba dong cua hom nay duoc tru; dong ngay mai khong dinh gi den so nay'
  );
});
