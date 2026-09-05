/**
 * Test cho "Nhiem vu moi ngay tinh nhu bai tap" (issue #30, nang cap #25).
 *
 * #25 chi lam viec nha thanh mot popup nhac — tick hay khong tick khong anh
 * huong gi den trang thai "hom nay da xong". Captain muon nguoc lai: chua tick
 * het viec nha thi ngay do KHONG duoc tinh la hoan thanh, du bai tap da xong het.
 *
 * lib/store.ts (progressUpcoming) sua bang cach CONG THEM so viec nha dang bat
 * vao total/done cua hom nay — xem chu thich ngay tren ham do. Test o day KHONG
 * import lib/store.ts: file do dung import khong duoi (`from './db'`) de Next
 * bundler tu resolve, con node --test thi doi import phai ghi ro duoi .ts (xem
 * tsconfig.json) nen import thang se loi "Cannot find module './db'". Vi vay bai
 * test nay mo phong LAI dung cau SQL cua progressUpcoming, chay tren PGlite that
 * — sua logic hoan thanh o store.ts thi phai sua ca o day cho khop.
 *
 * Chay tren PGlite trong bo nho, qua chinh bo chay migration cua du an
 * (scripts/db.mjs) — giong nhu lib/nhiem-vu-moi-ngay.test.ts.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { chayMigrations } from '../scripts/db.mjs';

const HOM_NAY = '2026-09-04';

let db: PGlite;
let boChay: { query: (t: string, p?: unknown[]) => Promise<Record<string, unknown>[]> };

const rows = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];

/**
 * Mo phong CHINH XAC hai truy van cua progressUpcoming (lib/store.ts) cho MOT
 * con, roi cong gop dung cach ham do dang lam: total/done cua hom nay = bai tap
 * (upcoming) CONG viec nha dang bat; homeworkTotal rieng chi bai tap, dung de
 * phan biet "chua duoc giao bai" voi "con thieu viec nha".
 */
async function tienDo(familyId: string, childId: string) {
  const bai = await rows(
    `SELECT status, due_date::text AS due_date FROM assignments
      WHERE child_id = '${childId}' AND (due_date >= '${HOM_NAY}' OR status = 'todo')`
  );
  const upcoming = bai.filter((r) => String(r.due_date) >= HOM_NAY);
  const homeworkTotal = upcoming.length;
  const homeworkDone = upcoming.filter((r) => r.status === 'done').length;

  const viec = await rows(
    `SELECT id FROM daily_chores WHERE family_id = '${familyId}' AND enabled`
  );
  const tick = await rows(
    `SELECT k.id FROM daily_chore_checks k
       JOIN daily_chores ch ON ch.id = k.chore_id
      WHERE ch.family_id = '${familyId}' AND ch.enabled
        AND k.child_id = '${childId}' AND k.done_date = '${HOM_NAY}'`
  );
  const choresDone = Math.min(viec.length, tick.length);

  return {
    total: homeworkTotal + viec.length,
    done: homeworkDone + choresDone,
    homeworkTotal,
  };
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

  // Nha tao SAU khi 012 da chay lan dau se khong duoc nap gi (WHERE NOT EXISTS
  // trong 012 chi xet nha co san LUC 012 chay) — giong het nhiem-vu-moi-ngay.test.ts,
  // phai cho 012 chay LAI thi nha moi tao moi duoc nap 3 viec mac dinh.
  await db.exec(
    `INSERT INTO families (id, name, slug, parent_pin_hash) VALUES
       ('fam_x', 'Nhà X', 'nha-x', 'hx');
     INSERT INTO children (id, family_id, name, grade, color, avatar_url) VALUES
       ('con_x', 'fam_x', 'Bi', 'Lớp 1', 'primary', '/img/x.png');`
  );
  await db.exec(`DELETE FROM _migrations WHERE name = '012_nhiem_vu_moi_ngay.sql'`);
  await chayMigrations(boChay);
});

after(async () => { await db.close(); });

test('lam het bai tap hom nay nhung CHUA tick viec nha: ngay chua duoc tinh hoan thanh', async () => {
  await db.exec(
    `INSERT INTO assignments (id, child_id, subject, content, due_date, status)
     VALUES ('a1', 'con_x', 'Toán', 'Làm trang 5', '${HOM_NAY}', 'done')`
  );

  const { total, done, homeworkTotal } = await tienDo('fam_x', 'con_x');
  assert.equal(homeworkTotal, 1, 'co dung 1 bai tap hom nay');
  assert.ok(
    done < total,
    `bai da xong nhung con 3 viec nha chua tick thi khong duoc tinh xong (done=${done}, total=${total})`
  );
});

test('lam het bai tap VA tick het viec nha: ngay duoc tinh hoan thanh', async () => {
  const chores = await rows(`SELECT id FROM daily_chores WHERE family_id = 'fam_x' AND enabled`);
  assert.equal(chores.length, 3, 'nha nay phai co du 3 viec mac dinh tu migration 012');

  for (const [i, c] of chores.entries()) {
    await db.exec(
      `INSERT INTO daily_chore_checks (id, child_id, chore_id, done_date)
       VALUES ('tik_${i}', 'con_x', '${c.id}', '${HOM_NAY}')`
    );
  }

  const { total, done } = await tienDo('fam_x', 'con_x');
  assert.equal(done, total, 'bai va viec nha da xong het thi done phai bang total');
});

test('con khong duoc giao bai nao: homeworkTotal = 0 du viec nha van con', async () => {
  await db.exec(`INSERT INTO children (id, family_id, name, grade, color, avatar_url)
                  VALUES ('con_y', 'fam_x', 'Su', 'Lớp 2', 'secondary', '/img/y.png')`);

  const { total, done, homeworkTotal } = await tienDo('fam_x', 'con_y');
  assert.equal(homeworkTotal, 0, 'khong co bai tap nao cho con nay');
  assert.equal(total, 3, 'total van cong 3 viec nha cua nha (dung de tinh hoan thanh khi co bai)');
  assert.equal(done, 0, 'chua tick viec nha nao');
});
