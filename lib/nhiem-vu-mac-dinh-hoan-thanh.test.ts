/**
 * Test cho "Nhiem vu mac dinh tinh nhu bai tap, tao cung luc voi bai cua ngay"
 * (issue #36, nang cap #25/#30).
 *
 * #25 chi lam viec nha thanh mot popup nhac o man /xong — tick hay khong tick
 * khong anh huong den trang thai "hom nay da xong". #30 cong THEM so viec nha
 * dang bat vao total/done cua progressUpcoming, nhung viec nha van chi song o
 * daily_chores/daily_chore_checks, tach biet voi assignments.
 *
 * #36 di xa hon: viec nha gio la MOT DONG THAT trong assignments (cot chore_id,
 * xem migrations/013_viec_nha_thanh_bai_tap.sql), duoc TAO cung luc voi bai tap
 * cho mot ngay cu the (saveSubmission trong lib/store.ts), chu khong con la
 * mot danh sach luon-co-san cong rieng vao progressUpcoming nua. Test o day
 * KHONG import lib/store.ts: file do dung import khong duoi (`from './db'`) de
 * Next bundler tu resolve, con node --test thi doi import phai ghi ro duoi .ts
 * (xem tsconfig.json) nen import thang se loi "Cannot find module './db'". Vi
 * vay bai test nay mo phong LAI dung cau SQL cua progressUpcoming, chay tren
 * PGlite that — sua logic hoan thanh o store.ts thi phai sua ca o day cho khop.
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
 * Mo phong CHINH XAC cau truy van cua progressUpcoming (lib/store.ts) cho MOT
 * con: mot cau duy nhat tren assignments (chore_id de tach homeworkTotal), MOI
 * la khac voi ban truoc #36 — khong con cau rieng tren daily_chore_checks nua,
 * vi dong viec nha da nam san trong assignments.
 */
async function tienDo(childId: string) {
  const bai = await rows(
    `SELECT status, due_date::text AS due_date, chore_id FROM assignments
      WHERE child_id = '${childId}' AND (due_date >= '${HOM_NAY}' OR status = 'todo')`
  );
  const upcoming = bai.filter((r) => String(r.due_date) >= HOM_NAY);
  return {
    total: upcoming.length,
    done: upcoming.filter((r) => r.status === 'done').length,
    homeworkTotal: upcoming.filter((r) => r.chore_id === null).length,
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

  // Mo phong dung dieu saveSubmission lam: tao mot dong assignments cho MOI
  // viec nha dang bat, cho ngay hom nay — con CHUA tick nen status = 'todo'.
  const chores = await rows(`SELECT id FROM daily_chores WHERE family_id = 'fam_x' AND enabled`);
  assert.equal(chores.length, 3, 'nha nay phai co du 3 viec mac dinh tu migration 012');
  for (const [i, c] of chores.entries()) {
    await db.exec(
      `INSERT INTO assignments (id, child_id, subject, content, due_date, status, chore_id)
       VALUES ('chr_asg_${i}', 'con_x', 'Việc nhà', 'viec', '${HOM_NAY}', 'todo', '${c.id}')`
    );
  }

  const { total, done, homeworkTotal } = await tienDo('con_x');
  assert.equal(homeworkTotal, 1, 'co dung 1 bai tap that hom nay (viec nha khong tinh vao day)');
  assert.equal(total, 4, 'total = 1 bai that + 3 dong viec nha da duoc tao');
  assert.ok(
    done < total,
    `bai da xong nhung con 3 viec nha chua tick thi khong duoc tinh xong (done=${done}, total=${total})`
  );
});

test('lam het bai tap VA tick het viec nha: ngay duoc tinh hoan thanh', async () => {
  // Tick viec nha gio la PATCH /api/assignments/:id nhu bai tap thuong — mo
  // phong bang cach chuyen thang status cua ba dong viec nha da tao o tren.
  await db.exec(
    `UPDATE assignments SET status = 'done' WHERE chore_id IS NOT NULL AND child_id = 'con_x'`
  );

  const { total, done } = await tienDo('con_x');
  assert.equal(done, total, 'bai va viec nha da xong het thi done phai bang total');
});

test('con khong duoc giao bai nao: khong co dong viec nha nao duoc tao, total = 0', async () => {
  await db.exec(`INSERT INTO children (id, family_id, name, grade, color, avatar_url)
                  VALUES ('con_y', 'fam_x', 'Su', 'Lớp 2', 'secondary', '/img/y.png')`);

  // KHAC voi hanh vi truoc #36: viec nha khong con la mot danh sach luon-co-san
  // (khong phu thuoc bai tap) — no chi xuat hien khi saveSubmission tao no cho
  // mot ngay cu the. Con nay chua bao gio duoc giao bai nen chua co dong viec
  // nha nao ca — total phai la 0, khong phai 3 nhu cong thuc cu (progressUpcoming
  // truoc day cong CHUNG so viec nha dang bat cua ca nha, bat ke con co bai
  // hay khong).
  const { total, done, homeworkTotal } = await tienDo('con_y');
  assert.equal(homeworkTotal, 0, 'khong co bai tap nao cho con nay');
  assert.equal(total, 0, 'chua tung duoc giao bai nen chua co dong viec nha nao duoc tao (issue #36)');
  assert.equal(done, 0, 'khong co gi de tinh xong');
});

test('hai dot nop bai cung ngay cho cung mot con: khong tao trung viec nha (unique index)', async () => {
  await db.exec(`INSERT INTO children (id, family_id, name, grade, color, avatar_url)
                  VALUES ('con_z', 'fam_x', 'Bo', 'Lớp 3', 'tertiary', '/img/z.png')`);

  const chores = await rows(`SELECT id FROM daily_chores WHERE family_id = 'fam_x' AND enabled`);
  const NGAY = '2026-09-10';

  // Mo phong dung logic saveSubmission: dot nop bai THU NHAT trong ngay tao du
  // 3 dong viec nha cho con_z.
  for (const c of chores) {
    await db.exec(
      `INSERT INTO assignments (id, child_id, subject, content, due_date, status, chore_id)
       VALUES ('z1_${c.id}', 'con_z', 'Việc nhà', 'viec', '${NGAY}', 'todo', '${c.id}')
       ON CONFLICT (child_id, due_date, chore_id) WHERE chore_id IS NOT NULL DO NOTHING`
    );
  }
  // Dot nop bai THU HAI cung ngay (vd lop tieng Anh nhap sau) cu goi lai y het
  // — ON CONFLICT tren unique index phai chan, khong duoc sinh them dong nao.
  for (const c of chores) {
    await db.exec(
      `INSERT INTO assignments (id, child_id, subject, content, due_date, status, chore_id)
       VALUES ('z2_${c.id}', 'con_z', 'Việc nhà', 'viec', '${NGAY}', 'todo', '${c.id}')
       ON CONFLICT (child_id, due_date, chore_id) WHERE chore_id IS NOT NULL DO NOTHING`
    );
  }

  const soDongViecNha = await rows(
    `SELECT id FROM assignments WHERE child_id = 'con_z' AND due_date = '${NGAY}' AND chore_id IS NOT NULL`
  );
  assert.equal(soDongViecNha.length, 3, 'hai dot nop bai cung ngay chi duoc tao dung 3 dong viec nha, khong trung');
});
