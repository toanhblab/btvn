/**
 * Test cho "Nhiem vu hang ngay co thuong sao" (issue #42, migration 016) —
 * chay THAT tren PGlite qua chinh bo chay migration cua du an (scripts/db.mjs),
 * giong lib/nhiem-vu-mac-dinh-hoan-thanh.test.ts.
 *
 * Khong import lib/store.ts duoc (import khong duoi, xem chu thich o test kia),
 * nen `taoNhiemVuNgay` duoi day MO PHONG LAI dung cau INSERT ... SELECT cua ham
 * cung ten trong lib/store.ts (va scripts/seed.mjs cung nhan ban cau do) — sua
 * mot ben la phai sua ca ba.
 *
 * Nhung dieu de vo ma khong ai thay, kiem o day:
 *   1. Nang DB dang co nha: ba viec mac dinh GIU NGUYEN id, nhan DEFAULT 1 ⭐ /
 *      🧹 / nhom 'after_study' / ca nha — khong migration nao xoa hay tao lai.
 *      016 chay lai duoc.
 *   2. Tao luoi dong cua ngay: idempotent (goi hai lan, hai request cung luc);
 *      NGAY KHONG CO BAI van co nhiem vu; loc theo child_ids (null = ca nha);
 *      nhiem vu tat / da bo khong tao dong; chep stars/icon/content luc tao.
 *   3. Sua cau hinh sau do: dong hom nay giu stars/icon/content cu; nhom doc
 *      live qua JOIN (dung nhu listAssignments).
 *   4. Loc theo nhom cho hai nhom tren man cua con.
 *   5. CHECK: stars ngoai 1..10 va nhom la bi chan.
 *   6. Ba ham thuan lamSachSao / nhomNhiemVuOf / docChildIds (lib/types.ts).
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { chayMigrations } from '../scripts/db.mjs';
import { docChildIds, lamSachSao, nhomNhiemVuOf, MAX_SAO_NHIEM_VU } from './types.ts';

const TEP_016 = '016_nhiem_vu_hang_ngay_thuong_sao.sql';

let db: PGlite;
let boChay: { query: (t: string, p?: unknown[]) => Promise<Record<string, unknown>[]> };

const rows = async (sql: string, params: unknown[] = []) =>
  (await db.query(sql, params)).rows as Record<string, unknown>[];

/** Mo phong CHINH XAC taoNhiemVuNgay (lib/store.ts). */
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

/** Mo phong phan doc cua listAssignments(includeChores) cho (con, ngay): nhom doc LIVE qua JOIN. */
async function dongCua(childId: string, date: string) {
  return rows(
    `SELECT a.id, a.content, a.icon, a.stars, a.chore_id, dc.category AS chore_category, dc.sort_order
       FROM assignments a LEFT JOIN daily_chores dc ON dc.id = a.chore_id
      WHERE a.child_id = $1 AND a.due_date = $2 AND a.chore_id IS NOT NULL
      ORDER BY dc.sort_order ASC NULLS FIRST, a.id ASC`,
    [childId, date]
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

  // Dung lai canh DB THAT truoc khi 016 chay: bo bon cot moi + so sach 016, nha
  // "cu" da co ba viec mac dinh (id co dinh) va mot dong viec nha hom nay, roi
  // cho 016 chay lai.
  await db.exec(`ALTER TABLE daily_chores DROP COLUMN stars, DROP COLUMN icon, DROP COLUMN child_ids, DROP COLUMN category`);
  await db.exec(`ALTER TABLE assignments DROP COLUMN stars`);
  await db.exec(`DROP INDEX score_events_task_once_idx`);
  await db.exec(`DELETE FROM _migrations WHERE name = '${TEP_016}'`);
  await db.exec(
    `INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ('fam_cu', 'Nhà cũ', 'nha-cu', 'h1');
     INSERT INTO children (id, family_id, name, grade, color, avatar_url, sort_order) VALUES
       ('minh', 'fam_cu', 'Minh', 'Lớp 1', 'primary', '/a.png', 1),
       ('an',   'fam_cu', 'An',   'Lớp 1', 'secondary', '/b.png', 2),
       ('na',   'fam_cu', 'Na',   'Mẫu giáo', 'tertiary', '/c.png', 3);
     INSERT INTO daily_chores (id, family_id, content, sort_order) VALUES
       ('chr_1', 'fam_cu', 'Cất sách vở vào ba lô', 1),
       ('chr_2', 'fam_cu', 'Tắt đèn học', 2),
       ('chr_3', 'fam_cu', 'Soạn sách vở cho ngày mai', 3);
     INSERT INTO assignments (id, child_id, subject, icon, content, due_date, status, chore_id) VALUES
       ('asg_cu', 'minh', 'Việc nhà', '🧹', 'Tắt đèn học', '2026-09-08', 'todo', 'chr_2');`
  );
  await chayMigrations(boChay);
});

after(async () => { await db.close(); });

test('016: ba viec mac dinh GIU id, nhan DEFAULT 1 ⭐ / 🧹 / after_study / ca nha; dong cu stars NULL; chay lai duoc', async () => {
  const chores = await rows(`SELECT id, stars, icon, category, child_ids FROM daily_chores WHERE family_id = 'fam_cu' ORDER BY sort_order`);
  assert.deepEqual(chores.map((c) => c.id), ['chr_1', 'chr_2', 'chr_3'], 'khong dong nao bi xoa / tao lai');
  for (const c of chores) {
    assert.equal(Number(c.stars), 1);
    assert.equal(c.icon, '🧹');
    assert.equal(c.category, 'after_study');
    assert.equal(c.child_ids, null);
  }
  const [cu] = await rows(`SELECT stars FROM assignments WHERE id = 'asg_cu'`);
  assert.equal(cu.stars, null, 'dong viec nha da tao truoc 016 khong duoc cong bu sao');

  await db.exec(`DELETE FROM _migrations WHERE name = '${TEP_016}'`);
  await chayMigrations(boChay);
  const [{ n }] = await rows(`SELECT COUNT(*) AS n FROM _migrations WHERE name = '${TEP_016}'`);
  assert.equal(Number(n), 1);
});

test('ngay KHONG co bai: mo man van tao du nhiem vu cho ca nha; goi lai / hai request cung luc khong tao trung', async () => {
  const NGAY = '2026-09-13';   // thu Bay, khong ai giao bai
  const [{ n0 }] = await rows(`SELECT COUNT(*) AS n0 FROM assignments WHERE due_date = $1`, [NGAY]);
  assert.equal(Number(n0), 0, 'chua co bai nao cho ngay nay');

  await taoNhiemVuNgay('fam_cu', NGAY, null);
  for (const con of ['minh', 'an', 'na']) {
    assert.equal((await dongCua(con, NGAY)).length, 3, `${con} co 3 nhiem vu du khong co bai`);
  }

  await taoNhiemVuNgay('fam_cu', NGAY, null);
  await Promise.all([taoNhiemVuNgay('fam_cu', NGAY, ['minh']), taoNhiemVuNgay('fam_cu', NGAY, null)]);
  const [{ n }] = await rows(`SELECT COUNT(*) AS n FROM assignments WHERE due_date = $1`, [NGAY]);
  assert.equal(Number(n), 9, 'van dung 9 dong (3 con x 3 viec)');
});

test('chep stars/icon/content luc tao; nhiem vu moi them giua ngay xuat hien o lan mo sau; sua cau hinh KHONG doi dong da tao', async () => {
  const NGAY = '2026-09-14';
  await db.exec(
    `INSERT INTO daily_chores (id, family_id, content, icon, stars, category, sort_order)
     VALUES ('chr_rang', 'fam_cu', 'Đánh răng buổi tối', '🪥', 2, 'housework', 4)`
  );
  await taoNhiemVuNgay('fam_cu', NGAY, ['minh']);
  let dong = await dongCua('minh', NGAY);
  const rang = dong.find((d) => d.chore_id === 'chr_rang')!;
  assert.equal(rang.content, 'Đánh răng buổi tối');
  assert.equal(rang.icon, '🪥');
  assert.equal(Number(rang.stars), 2);
  assert.equal(rang.chore_category, 'housework');

  // Bo me sua sao/icon/chu va DOI NHOM sau khi dong hom nay da tao
  await db.exec(`UPDATE daily_chores SET stars = 5, icon = '🦷', content = 'Đánh răng', category = 'after_study' WHERE id = 'chr_rang'`);
  await taoNhiemVuNgay('fam_cu', NGAY, ['minh']);
  dong = await dongCua('minh', NGAY);
  const sau = dong.find((d) => d.chore_id === 'chr_rang')!;
  assert.equal(sau.id, rang.id, 'khong tao dong moi thay dong cu');
  assert.equal(Number(sau.stars), 2, 'stars da chep luc tao -> giu 2, khong len 5');
  assert.equal(sau.icon, '🪥', 'icon giu cu');
  assert.equal(sau.content, 'Đánh răng buổi tối', 'chu giu cu');
  assert.equal(sau.chore_category, 'after_study', 'NHOM doc live nen doi theo cau hinh');

  // Ngay mai moi nhan gia tri moi
  await taoNhiemVuNgay('fam_cu', '2026-09-15', ['minh']);
  const mai = (await dongCua('minh', '2026-09-15')).find((d) => d.chore_id === 'chr_rang')!;
  assert.equal(Number(mai.stars), 5);
  assert.equal(mai.icon, '🦷');
  await db.exec(`UPDATE daily_chores SET category = 'housework' WHERE id = 'chr_rang'`);
});

test('loc theo con: child_ids = [minh, an] -> Na khong co dong; null = ca nha; con them sau tu duoc nhan', async () => {
  const NGAY = '2026-09-16';
  await db.exec(
    `INSERT INTO daily_chores (id, family_id, content, icon, stars, category, child_ids, sort_order)
     VALUES ('chr_sach', 'fam_cu', 'Đọc sách 15 phút', '📚', 3, 'housework', ARRAY['minh','an'], 5)`
  );
  await taoNhiemVuNgay('fam_cu', NGAY, null);
  const coSach = async (con: string) => (await dongCua(con, NGAY)).some((d) => d.chore_id === 'chr_sach');
  assert.equal(await coSach('minh'), true);
  assert.equal(await coSach('an'), true);
  assert.equal(await coSach('na'), false, 'Na khong duoc giao');
  assert.equal((await dongCua('na', NGAY)).some((d) => d.chore_id === 'chr_rang'), true, 'chr_rang la ca nha nen Na co');

  // Con them sau: viec "ca nha" (NULL) tu nhan, viec giao rieng thi khong
  await db.exec(`INSERT INTO children (id, family_id, name, grade, color, avatar_url, sort_order) VALUES ('bi', 'fam_cu', 'Bi', 'Lớp 2', 'primary', '/d.png', 4)`);
  await taoNhiemVuNgay('fam_cu', NGAY, null);
  const bi = await dongCua('bi', NGAY);
  assert.equal(bi.length, 4, '3 viec mac dinh + chr_rang (ca nha), khong co chr_sach');
  assert.equal(bi.some((d) => d.chore_id === 'chr_sach'), false);

  // id con nha khac / id la trong child_ids: vo hai
  await db.exec(`UPDATE daily_chores SET child_ids = ARRAY['khong_ton_tai'] WHERE id = 'chr_sach'`);
  await taoNhiemVuNgay('fam_cu', '2026-09-17', null);
  const [{ n }] = await rows(`SELECT COUNT(*) AS n FROM assignments WHERE due_date = '2026-09-17' AND chore_id = 'chr_sach'`);
  assert.equal(Number(n), 0);
  await db.exec(`UPDATE daily_chores SET child_ids = ARRAY['minh','an'] WHERE id = 'chr_sach'`);
});

test('nhiem vu TAT hoac DA BO khong tao dong moi; dong da tao giu nguyen chore_id', async () => {
  const NGAY = '2026-09-18';
  await db.exec(`UPDATE daily_chores SET enabled = false WHERE id = 'chr_1'`);
  await db.exec(`UPDATE daily_chores SET archived_at = now() WHERE id = 'chr_3'`);
  await taoNhiemVuNgay('fam_cu', NGAY, ['minh']);
  const ids = (await dongCua('minh', NGAY)).map((d) => d.chore_id);
  assert.equal(ids.includes('chr_1'), false, 'tat -> khong tao');
  assert.equal(ids.includes('chr_3'), false, 'da bo -> khong tao');
  assert.equal(ids.includes('chr_2'), true);
  // Dong cu cua chr_3 (ngay 13) van la viec nha
  const [{ n }] = await rows(`SELECT COUNT(*) AS n FROM assignments WHERE chore_id = 'chr_3'`);
  assert.ok(Number(n) > 0, 'lich su cua viec da bo con nguyen');
  await db.exec(`UPDATE daily_chores SET enabled = true WHERE id = 'chr_1'`);
});

test('chi giao cho mot so con (childIds cua saveSubmission): con khac khong duoc tao dong cho ngay do', async () => {
  const NGAY = '2026-09-19';
  await taoNhiemVuNgay('fam_cu', NGAY, ['an']);
  assert.ok((await dongCua('an', NGAY)).length > 0);
  assert.equal((await dongCua('minh', NGAY)).length, 0);
  assert.equal((await dongCua('na', NGAY)).length, 0);
  // id con nha khac trong childIds: khong tao gi (JOIN theo family_id)
  await db.exec(`INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ('fam_khac', 'Nhà khác', 'nha-khac', 'h2');
                 INSERT INTO children (id, family_id, name, grade, color, avatar_url) VALUES ('con_khac', 'fam_khac', 'X', 'L1', 'primary', '/x.png')`);
  await taoNhiemVuNgay('fam_cu', NGAY, ['con_khac']);
  assert.equal((await dongCua('con_khac', NGAY)).length, 0);
});

test('loc theo nhom: hai nhom tach rieng, thu tu trong nhom theo sort_order', async () => {
  const NGAY = '2026-09-16';
  const dong = await dongCua('minh', NGAY);
  const sauHoc = dong.filter((d) => d.chore_category === 'after_study').map((d) => d.chore_id);
  const viecNha = dong.filter((d) => d.chore_category === 'housework').map((d) => d.chore_id);
  assert.deepEqual(sauHoc, ['chr_1', 'chr_2', 'chr_3']);
  assert.deepEqual(viecNha, ['chr_rang', 'chr_sach']);
  assert.equal(sauHoc.length + viecNha.length, dong.length, 'khong dong nao rot ra ngoai hai nhom');
});

test('CHECK: stars ngoai 1..10, nhom la, assignments.stars <= 0 bi chan', async () => {
  await assert.rejects(
    db.exec(`INSERT INTO daily_chores (id, family_id, content, stars) VALUES ('x1', 'fam_cu', 'x', 0)`), /check/i
  );
  await assert.rejects(
    db.exec(`INSERT INTO daily_chores (id, family_id, content, stars) VALUES ('x2', 'fam_cu', 'x', 11)`), /check/i
  );
  await assert.rejects(
    db.exec(`INSERT INTO daily_chores (id, family_id, content, category) VALUES ('x3', 'fam_cu', 'x', 'khac')`), /check/i
  );
  await assert.rejects(
    db.exec(`INSERT INTO assignments (id, child_id, subject, content, due_date, stars) VALUES ('x4', 'minh', 'T', 'x', '2026-09-20', 0)`), /check/i
  );
});

test('lamSachSao / nhomNhiemVuOf (ham thuan)', () => {
  assert.equal(lamSachSao(3), 3);
  assert.equal(lamSachSao('7'), 7);
  assert.equal(lamSachSao(2.6), 3);
  assert.equal(lamSachSao(MAX_SAO_NHIEM_VU), MAX_SAO_NHIEM_VU);
  assert.equal(lamSachSao(0), null);
  assert.equal(lamSachSao(11), null);
  assert.equal(lamSachSao('abc'), null);
  assert.equal(lamSachSao(undefined), null);
  assert.equal(nhomNhiemVuOf('housework'), 'housework');
  assert.equal(nhomNhiemVuOf('after_study'), 'after_study');
  assert.equal(nhomNhiemVuOf('gi-do'), 'after_study');
  assert.equal(nhomNhiemVuOf(undefined), 'after_study');
});

test('docChildIds (ham thuan): bam chip con o hang "Giao cho"', () => {
  // Dang "Cả nhà" -> bam mot con la chi giao cho con do.
  assert.deepEqual(docChildIds(null, 'minh'), ['minh']);
  // Them / bo con khi dang co danh sach.
  assert.deepEqual(docChildIds(['minh'], 'an'), ['minh', 'an']);
  assert.deepEqual(docChildIds(['minh', 'an'], 'minh'), ['an']);

  // Bo con CUOI CUNG: khong lam gi, va tra ve dung tham chieu cu de man bo me
  // biet la khong co gi doi (khong goi PATCH). Truoc day cho nay tra null =
  // "Cả nhà", nghia la bam de BO giao cho Minh lai hoa ra giao cho CA NHA.
  const chiMinh = ['minh'];
  assert.equal(docChildIds(chiMinh, 'minh'), chiMinh);
  assert.notEqual(docChildIds(chiMinh, 'minh'), null);
});
