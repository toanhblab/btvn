/**
 * Test cho luoc do "Nhiem vu moi ngay" (issue #25) — chay THAT tren Postgres,
 * bang chinh bo chay migration cua du an (scripts/db.mjs).
 *
 * Migration 012 khong chi tao bang: no con NAP ba viec mac dinh cho moi nha dang
 * co. Hai dieu de vo ma khong ai thay:
 *
 *   1. Tep 012 chay hai lan (deploy lai, hoac captain go tay lan nua) ma sinh
 *      them mot bo ba viec nua -> bo me mo man Cai dat thay sau dong trung nhau.
 *   2. Nha nao bo me da tu sua danh sach ma bi nap de len -> viec bo me xoa tu
 *      quay ve.
 *
 * Va khoa duy nhat (con, viec, ngay): tre bam mot viec vai lan la chuyen thuong,
 * moi lan bam khong duoc de lai mot dong rieng.
 *
 * Chay tren PGlite trong bo nho — Postgres that, nen dung dung nhung cau SQL se
 * chay tren DB that. scripts/db.mjs doc thu muc './migrations' theo thu muc dang
 * dung, tuc phai chay tu goc du an: `npm test` lam dung the.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { chayMigrations } from '../scripts/db.mjs';

const TEP_012 = '012_nhiem_vu_moi_ngay.sql';

let db: PGlite;
/** Lop bao mong dung khuon ma chayMigrations doi (giong moKetNoi trong db.mjs). */
let boChay: { query: (t: string, p?: unknown[]) => Promise<Record<string, unknown>[]> };

const rows = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];
const viecCua = async (familyId: string) =>
  (await rows(
    `SELECT content FROM daily_chores WHERE family_id = '${familyId}' ORDER BY sort_order`
  )).map((r) => r.content);

/**
 * Bat 012 chay lai tren DB nay: xoa dong so sach roi goi lai bo chay.
 *
 * Day chinh la canh cua DB that — 001..011 da chay tu truoc, gio moi den 012 va
 * trong DB DA CO nha. Cung la cach kiem "chay hai lan thi sao".
 */
async function chayLai012() {
  await db.exec(`DELETE FROM _migrations WHERE name = '${TEP_012}'`);
  await chayMigrations(boChay);
}

before(async () => {
  db = new PGlite();
  boChay = {
    query: async (t, p = []) => (await db.query(t, p)).rows as Record<string, unknown>[],
    chayGoi: async (cauLenh: { sql: string; params?: unknown[] }[]) => {
      await db.query('BEGIN');
      try {
        for (const c of cauLenh) await db.query(c.sql, c.params ?? []);
        await db.query('COMMIT');
      } catch (err) {
        await db.query('ROLLBACK');
        throw err;
      }
    },
  } as typeof boChay;

  await chayMigrations(boChay);

  // Hai nha co san TRUOC khi 012 chay — DB dang chay that, khong phai DB trong.
  await db.exec(
    `INSERT INTO families (id, name, slug, parent_pin_hash) VALUES
       ('fam_a', 'Nhà A', 'nha-a', 'h1'), ('fam_b', 'Nhà B', 'nha-b', 'h2');
     INSERT INTO children (id, family_id, name, grade, color, avatar_url) VALUES
       ('con_a', 'fam_a', 'Minh', 'Lớp 1', 'primary', '/img/a.png');`
  );
  await chayLai012();
});

after(async () => { await db.close(); });

test('012 nap ba viec mac dinh, dung thu tu, cho MOI nha dang co', async () => {
  const mongDoi = ['Cất sách vở vào ba lô', 'Tắt đèn học', 'Soạn sách vở cho ngày mai'];
  assert.deepEqual(await viecCua('fam_a'), mongDoi);
  assert.deepEqual(await viecCua('fam_b'), mongDoi);
});

test('012 chay lai lan nua khong sinh dong trung', async () => {
  await chayLai012();
  const [{ n }] = await rows(`SELECT COUNT(*) AS n FROM daily_chores`);
  assert.equal(Number(n), 6, 'chay lan hai phai khong them dong nao');
});

test('nha da tu sua danh sach thi 012 chay lai khong nap de len', async () => {
  await db.exec(`DELETE FROM daily_chores WHERE family_id = 'fam_b' AND content = 'Tắt đèn học'`);
  await chayLai012();
  assert.deepEqual(
    await viecCua('fam_b'),
    ['Cất sách vở vào ba lô', 'Soạn sách vở cho ngày mai'],
    'viec bo me da xoa khong duoc tu quay lai'
  );
});

test('tick mot viec nhieu lan trong ngay chi de lai mot dong; ngay khac la dong khac', async () => {
  const [viec] = await rows(`SELECT id FROM daily_chores WHERE family_id = 'fam_a' ORDER BY sort_order LIMIT 1`);
  const tick = (id: string, ngay: string) => db.exec(
    `INSERT INTO daily_chore_checks (id, child_id, chore_id, done_date)
     VALUES ('${id}', 'con_a', '${viec.id}', '${ngay}')
     ON CONFLICT (child_id, chore_id, done_date) DO NOTHING`
  );

  await tick('tik_1', '2026-09-02');
  await tick('tik_2', '2026-09-02');   // tre bam lai lan nua
  await tick('tik_3', '2026-09-03');   // hom sau

  const daTick = await rows(
    `SELECT done_date FROM daily_chore_checks WHERE child_id = 'con_a' ORDER BY done_date`
  );
  assert.equal(daTick.length, 2, 'bam hai lan trong mot ngay khong duoc thanh hai dong');
});

test('xoa mot viec thi keo theo nhung lan da tick (khong con dong mo coi)', async () => {
  const [viec] = await rows(`SELECT id FROM daily_chores WHERE family_id = 'fam_a' ORDER BY sort_order LIMIT 1`);
  await db.exec(`DELETE FROM daily_chores WHERE id = '${viec.id}'`);
  const [{ n }] = await rows(
    `SELECT COUNT(*) AS n FROM daily_chore_checks WHERE chore_id = '${viec.id}'`
  );
  assert.equal(Number(n), 0);
});
