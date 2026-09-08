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
 * Tu issue #42 progressUpcoming con goi taoNhiemVuNgay TRUOC khi dem, nen dong
 * nhiem vu cua hom nay khong con phu thuoc vao viec bo me co giao bai hay
 * khong (Q2) — phan mo phong duoi day co ca buoc tao luoi do, giong
 * lib/nhiem-vu-hang-ngay.test.ts.
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
 * Mo phong nhanh "Qua han" cua progressUpcoming: han truoc hom nay, con 'todo',
 * VA khong phai viec nha (chore_id IS NULL) — man bo me khong duoc thay viec nha
 * lam phinh badge nay.
 */
async function quaHan(childId: string) {
  const bai = await rows(
    `SELECT status, due_date::text AS due_date, chore_id FROM assignments
      WHERE child_id = '${childId}' AND (due_date >= '${HOM_NAY}' OR status = 'todo')`
  );
  return bai.filter(
    (r) => String(r.due_date) < HOM_NAY && r.status === 'todo' && r.chore_id === null
  ).length;
}

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

/**
 * Mo phong CHINH XAC cau INSERT ... SELECT cua taoNhiemVuNgay (lib/store.ts) —
 * buoc tao luoi ma progressUpcoming chay TRUOC khi dem tu issue #42. Cau nay
 * con duoc nhan ban o scripts/seed.mjs va lib/nhiem-vu-hang-ngay.test.ts (node
 * khong import duoc lib/store.ts, xem chu thich dau file): sua mot cho la phai
 * sua het.
 */
async function taoNhiemVuNgay(familyId: string, date: string, childIds: string[] | null) {
  await db.query(
    `INSERT INTO assignments
       (id, child_id, subject, icon, content, lang, due_date, source, duration_minutes,
        requires_video, chore_id, stars)
     SELECT 'asg_' || substr(md5(random()::text || c.id || dc.id || $2::text), 1, 16),
            c.id, $3, dc.icon, dc.content, 'vi', $2::date, $4, $5, false, dc.id, dc.stars
       FROM daily_chores dc
       JOIN children c ON c.family_id = dc.family_id
      WHERE dc.family_id = $1 AND dc.enabled AND dc.archived_at IS NULL
        AND (dc.child_ids IS NULL OR c.id = ANY(dc.child_ids))
        AND ($6::text[] IS NULL OR c.id = ANY($6::text[]))
     ON CONFLICT (child_id, due_date, chore_id) WHERE chore_id IS NOT NULL DO NOTHING`,
    [familyId, date, 'Việc nhà', 'primary_school', 10, childIds]
  );
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

test('con khong duoc giao bai nao: chua chay tao luoi thi chua co dong nhiem vu nao', async () => {
  await db.exec(`INSERT INTO children (id, family_id, name, grade, color, avatar_url)
                  VALUES ('con_y', 'fam_x', 'Su', 'Lớp 2', 'secondary', '/img/y.png')`);

  // KHAC voi hanh vi truoc #36: nhiem vu khong con la mot danh sach luon-co-san
  // cong thang vao tien do (progressUpcoming truoc day cong CHUNG so viec nha
  // dang bat cua ca nha, bat ke con co bai hay khong) — no chi duoc tinh khi co
  // DONG THAT trong assignments.
  const { total, done, homeworkTotal } = await tienDo('con_y');
  assert.equal(homeworkTotal, 0, 'khong co bai tap that nao cho con nay');
  assert.equal(total, 0, 'chua co dong nao trong assignments thi chua co gi de dem');
  assert.equal(done, 0, 'khong co gi de tinh xong');
});

test('con khong duoc giao bai nao: sau buoc tao luoi cua #42 van co du nhiem vu hom nay', async () => {
  // Tu #42 (Q2) nhiem vu phai hien MOI NGAY, ke ca ngay bo me khong giao bai —
  // nen progressUpcoming goi taoNhiemVuNgay(familyId, today, null) TRUOC khi dem
  // (lib/store.ts). Day chinh la so ma badge "N viec" o man chon-con dua vao:
  // con chua tung duoc giao bai van co du dong nhiem vu cua hom nay.
  const dangBat = await rows(
    `SELECT id FROM daily_chores WHERE family_id = 'fam_x' AND enabled AND archived_at IS NULL`
  );
  assert.equal(dangBat.length, 3, 'nha nay dang bat dung 3 nhiem vu');

  await taoNhiemVuNgay('fam_x', HOM_NAY, null);

  const { total, done, homeworkTotal } = await tienDo('con_y');
  assert.equal(homeworkTotal, 0, 'van khong co bai tap that nao cho con nay');
  assert.equal(total, 3, 'ba nhiem vu dang bat -> ba dong cua hom nay (issue #42 Q2)');
  assert.equal(done, 0, 'con chua tick nhiem vu nao');

  // Goi lai (moi lan mo man la mot lan goi) khong duoc sinh them dong nao.
  await taoNhiemVuNgay('fam_x', HOM_NAY, null);
  assert.equal((await tienDo('con_y')).total, 3, 'tao luoi phai idempotent');
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

/**
 * Hop dong luoc do ma deleteChore (lib/store.ts) dua vao, do
 * migrations/013 + 014 dat ra: chore_id la dau hieu DUY NHAT phan biet mot dong
 * assignments la viec nha hay bai tap that, nen bo mot viec nha KHONG duoc lam
 * mat dau hieu do o cac dong da tao.
 *
 * Hai nhanh chay canh nhau tren cung mot du lieu de thay ro cai gia: DELETE that
 * (deleteChore truoc day) keo chore_id ve NULL — dong viec nha qua han hoa thanh
 * bai tap that va nhay vao badge "Qua han" cua bo me, ma con khong con duong nao
 * tick no. Danh dau da bo (archived_at) giu nguyen chore_id.
 */
test('bo mot viec nha (archived_at) giu nguyen chore_id cua cac dong da tao; DELETE that thi khong', async () => {
  const HOM_QUA = '2026-09-03';
  await db.exec(
    `INSERT INTO children (id, family_id, name, grade, color, avatar_url) VALUES
       ('con_bo', 'fam_x', 'Ti', 'Lớp 1', 'primary', '/img/b.png');
     INSERT INTO daily_chores (id, family_id, content, sort_order) VALUES
       ('chr_bo', 'fam_x', 'Tưới cây', 8),
       ('chr_xoa', 'fam_x', 'Gấp chăn', 9);
     INSERT INTO assignments (id, child_id, subject, content, due_date, status, chore_id) VALUES
       ('bo_1', 'con_bo', 'Việc nhà', 'Tưới cây', '${HOM_QUA}', 'todo', 'chr_bo'),
       ('xoa_1', 'con_bo', 'Việc nhà', 'Gấp chăn', '${HOM_QUA}', 'todo', 'chr_xoa')`
  );

  assert.equal(await quaHan('con_bo'), 0, 'hai dong nay deu la viec nha nen chua tinh vao "Qua han"');

  // Dung cau lenh deleteChore chay tu nay.
  await db.exec(`UPDATE daily_chores SET archived_at = now() WHERE id = 'chr_bo'`);

  // ...va cau lenh deleteChore chay TRUOC day, de doi chieu.
  await db.exec(`DELETE FROM daily_chores WHERE id = 'chr_xoa'`);

  const conHien = await rows(
    `SELECT id FROM daily_chores WHERE family_id = 'fam_x' AND archived_at IS NULL AND id = 'chr_bo'`
  );
  assert.equal(conHien.length, 0, 'viec da bo phai bien mat khoi moi duong doc cua man Cai dat');

  const [daBo] = await rows(`SELECT chore_id FROM assignments WHERE id = 'bo_1'`);
  assert.equal(daBo.chore_id, 'chr_bo', 'dong lich su cua viec da bo phai giu nguyen chore_id');

  const [daXoa] = await rows(`SELECT chore_id FROM assignments WHERE id = 'xoa_1'`);
  assert.equal(daXoa.chore_id, null, 'DELETE that keo chore_id ve NULL — chinh la ly do khong xoa that nua');

  assert.equal(
    await quaHan('con_bo'),
    1,
    'chi dong cua viec bi XOA THAT lot vao "Qua han"; dong cua viec da bo van la viec nha'
  );
});
