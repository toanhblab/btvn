/**
 * Test luoc do + SQL tinh diem / doi thuong (migrations/015_tinh_diem_doi_thuong.sql)
 * — chay THAT tren PGlite qua chinh bo chay migration cua du an (scripts/db.mjs),
 * giong lib/nhiem-vu-mac-dinh-hoan-thanh.test.ts.
 *
 * Khong import lib/store.ts duoc (import khong duoi, xem chu thich o test kia),
 * nen ba ham `danhDauXong` / `congDiemNgay` / `ghiDiem` duoi day MO PHONG LAI
 * dung cac cau SQL cua setStatus, congDiemNgayNeuXong va ghiDiemSauKhiXong
 * (lib/store.ts) + cac ham thuan trong lib/diem.ts — sua logic cong diem o
 * store.ts thi phai sua ca o day cho khop.
 *
 * Nhung dieu de vo ma khong ai thay, kiem o day:
 *   1. Nang DB dang co nha: score_since cua nha cu = ngay migration chay
 *      (khong hoi to).
 *   2. "Cong mot lan": unique index chan cong 10 diem hai lan cho cung (con,
 *      ngay), va +1 hai lan cho cung mot bai — ke ca khi con bo tick roi tick lai.
 *   3. So du = SUM(score_events) - SUM(reward_redemptions da duyet); dang cho /
 *      tu choi khong tru.
 *   4. Moi con mot yeu cau dang cho; duyet xong thi xin tiep duoc.
 *   5. Xoa bai / xoa phan thuong khong lam mat diem hay lich su; xoa con thi
 *      keo theo het (CASCADE).
 *   6. Ghi diem loi giua duong: lan goi sau cua chinh bai do cong not phan con
 *      thieu (nho started_at / completed_at trong DB), va khong cong trung.
 *   7. Bo me BOT viec cua mot ngay (xoa bai / doi dueDate sang ngay khac) lam
 *      ngay do thanh hoan thanh: van duoc +10, dung mot lan, dung nha.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { chayMigrations } from '../scripts/db.mjs';
import {
  DIEM_NGAY_XONG, DIEM_XONG_SOM, ngayDuocTinhDiem, ngayHoanThanh, xongSom,
} from './diem.ts';

const TEP_015 = '015_tinh_diem_doi_thuong.sql';
const PHUT = 60_000;

let db: PGlite;
let boChay: { query: (t: string, p?: unknown[]) => Promise<Record<string, unknown>[]> };

const rows = async (sql: string, params: unknown[] = []) =>
  (await db.query(sql, params)).rows as Record<string, unknown>[];

let dem = 0;
const id = (p: string) => `${p}_${++dem}`;

/** So du dung cong thuc cua soDiemTheoCon (lib/store.ts). */
async function soDu(childId: string): Promise<number> {
  const [r] = await rows(
    `SELECT COALESCE((SELECT SUM(e.points) FROM score_events e WHERE e.child_id = $1), 0)
          - COALESCE((SELECT SUM(r.cost) FROM reward_redemptions r
                       WHERE r.child_id = $1 AND r.status = 'approved'), 0) AS points`,
    [childId]
  );
  return Number(r.points);
}

const soMs = (v: unknown): number | null => (v ? new Date(v as string).getTime() : null);

/**
 * Mo phong setStatus(done = true) (lib/store.ts): MOT cau UPDATE ghi ca status,
 * moc xong va moc bat dau may con gui len — de moc song sot ke ca khi buoc cong
 * diem chay sau do loi. `nowMs` thay cho now() de test giu quyen dieu khien gio.
 */
async function danhDauXong(asgId: string, startedAtMs: number | null, nowMs: number) {
  await db.query(
    `UPDATE assignments
        SET status = 'done',
            completed_at = COALESCE(completed_at, $2::timestamptz),
            started_at = COALESCE($3::timestamptz, started_at)
      WHERE id = $1`,
    [
      asgId,
      new Date(nowMs).toISOString(),
      startedAtMs === null ? null : new Date(startedAtMs).toISOString(),
    ]
  );
}

/**
 * Mo phong congDiemNgayNeuXong(familyId, childId, dueDate): xet ca ngay va cong
 * +10 neu xong het. Ham that duoc goi ca tu duong tick cua con VA tu hai thao
 * tac cua bo me lam bot viec cua ngay (xoa bai / doi dueDate).
 */
async function congDiemNgay(familyId: string, childId: string, dueDate: string) {
  const ngay = await rows(
    `SELECT a.status, a.chore_id, f.score_since::text AS score_since
       FROM assignments a
       JOIN children c ON c.id = a.child_id
       JOIN families f ON f.id = c.family_id
      WHERE a.child_id = $1 AND a.due_date = $2 AND c.family_id = $3`,
    [childId, dueDate, familyId]
  );
  if (ngay.length === 0) return { ngayXong: 0, ngayTinhDiem: false };

  const ngayTinhDiem = ngayDuocTinhDiem(dueDate, String(ngay[0].score_since));
  if (!ngayTinhDiem) return { ngayXong: 0, ngayTinhDiem: false };
  if (!ngayHoanThanh(ngay.map((r) => ({ status: String(r.status), choreId: r.chore_id as string | null })))) {
    return { ngayXong: 0, ngayTinhDiem };
  }

  const ins = await rows(
    `INSERT INTO score_events (id, child_id, kind, points, event_date)
     VALUES ($1, $2, 'day_complete', $3, $4)
     ON CONFLICT (child_id, event_date) WHERE kind = 'day_complete' DO NOTHING
     RETURNING id`,
    [id('sce'), childId, DIEM_NGAY_XONG, dueDate]
  );
  return { ngayXong: ins.length > 0 ? DIEM_NGAY_XONG : 0, ngayTinhDiem };
}

/**
 * Mo phong ghiDiemSauKhiXong: doc lai bai tu DB (nhu route lam sau khi cap nhat)
 * roi chay dung cac cau SQL cua ham do. Tra ve diem VUA cong o lan goi nay.
 *
 * Tach khoi danhDauXong vi ham that duoc goi o MOI PATCH cua con ma bai dang
 * done, khong chi lan vua tick — day la duong khoi phuc khi lan truoc ghi diem
 * loi. Ham nay KHONG ghi gi vao assignments, chi doc hai moc da luu.
 */
async function ghiDiem(asgId: string, familyId = 'fam_cu') {
  const [a] = await rows(
    `SELECT child_id, due_date::text AS due_date, duration_minutes, chore_id, status,
            started_at, completed_at
       FROM assignments WHERE id = $1`,
    [asgId]
  );
  const kq = { xongSom: 0, ngayXong: 0 };
  if (a.status !== 'done') return kq;

  const ngay = await congDiemNgay(familyId, String(a.child_id), String(a.due_date));
  kq.ngayXong = ngay.ngayXong;

  const mocBatDau = soMs(a.started_at);
  const mocXong = soMs(a.completed_at) ?? Date.now();
  if (ngay.ngayTinhDiem && mocBatDau !== null && a.chore_id === null &&
      xongSom(mocBatDau, mocXong, Number(a.duration_minutes))) {
    const ins = await rows(
      `INSERT INTO score_events (id, child_id, kind, points, event_date, assignment_id)
       VALUES ($1, $2, 'early_finish', $3, $4, $5)
       ON CONFLICT (assignment_id) WHERE kind = 'early_finish' DO NOTHING
       RETURNING id`,
      [id('sce'), a.child_id, DIEM_XONG_SOM, a.due_date, asgId]
    );
    if (ins.length > 0) kq.xongSom = DIEM_XONG_SOM;
  }
  return kq;
}

/**
 * Ca cu tick cua con: danh dau xong luc `nowMs` kem moc bat dau `startedAtMs`
 * (null = khong bam dong ho), roi route ghi diem.
 */
async function tickXong(asgId: string, startedAtMs: number | null, nowMs = Date.now()) {
  await danhDauXong(asgId, startedAtMs, nowMs);
  return ghiDiem(asgId);
}

async function themBai(childId: string, dueDate: string, opts: { chore?: string; phut?: number } = {}) {
  const asg = id('asg');
  await db.query(
    `INSERT INTO assignments (id, child_id, subject, content, due_date, status, chore_id, duration_minutes)
     VALUES ($1, $2, 'Toán', 'bài', $3, 'todo', $4, $5)`,
    [asg, childId, dueDate, opts.chore ?? null, opts.phut ?? 10]
  );
  return asg;
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

  // Dung lai canh DB THAT truoc khi 015 chay: bo cot score_since va so sach 015,
  // nha "cu" da co san, roi cho 015 chay lai — cot duoc them voi DEFAULT
  // CURRENT_DATE nen nha cu nhan dung ngay migration chay.
  await db.exec(`ALTER TABLE families DROP COLUMN score_since`);
  await db.exec(`DELETE FROM _migrations WHERE name = '${TEP_015}'`);
  await db.exec(
    `INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ('fam_cu', 'Nhà cũ', 'nha-cu', 'h1');
     INSERT INTO children (id, family_id, name, grade, color, avatar_url) VALUES
       ('con_a', 'fam_cu', 'Minh', 'Lớp 1', 'primary', '/a.png'),
       ('con_b', 'fam_cu', 'An', 'Lớp 1', 'secondary', '/b.png'),
       ('con_c', 'fam_cu', 'Bình', 'Lớp 1', 'tertiary', '/c.png');
     INSERT INTO daily_chores (id, family_id, content, sort_order) VALUES ('chr_1', 'fam_cu', 'Tắt đèn', 1);`
  );
  await chayMigrations(boChay);
});

after(async () => { await db.close(); });

test('015 chay lai duoc va nha dang co nhan score_since = ngay migration chay (khong hoi to)', async () => {
  const [{ score_since, hom_nay }] = await rows(
    `SELECT score_since::text AS score_since, CURRENT_DATE::text AS hom_nay FROM families WHERE id = 'fam_cu'`
  );
  assert.equal(score_since, hom_nay, 'nha cu phai bat dau tinh diem tu ngay migration chay');

  // Chay lan nua khong loi, khong doi gi (IF NOT EXISTS khap noi)
  await db.exec(`DELETE FROM _migrations WHERE name = '${TEP_015}'`);
  await chayMigrations(boChay);
  const [{ n }] = await rows(`SELECT COUNT(*) AS n FROM _migrations WHERE name = '${TEP_015}'`);
  assert.equal(Number(n), 1);
});

test('nha moi tao sau nay: score_since = ngay tao (DEFAULT)', async () => {
  await db.exec(`INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ('fam_moi', 'Nhà mới', 'nha-moi', 'h2')`);
  const [{ score_since, hom_nay }] = await rows(
    `SELECT score_since::text AS score_since, CURRENT_DATE::text AS hom_nay FROM families WHERE id = 'fam_moi'`
  );
  assert.equal(score_since, hom_nay);
});

test('ngay TRUOC score_since: xong het, xong ca SOM van KHONG duoc diem nao (khong hoi to)', async () => {
  await db.exec(`UPDATE families SET score_since = '2026-09-08' WHERE id = 'fam_cu'`);
  const NGAY_CU = '2026-09-07';
  const bai = await themBai('con_a', NGAY_CU, { phut: 10 });
  const viec = await themBai('con_a', NGAY_CU, { chore: 'chr_1' });

  // Tick kem moc bat dau 2' truoc: xong som THAT (10' cho bai 10'), nhung ngay
  // nay truoc score_since nen khong duoc +1 — luat khong hoi to ap cho ca hai loai.
  const gio = Date.now();
  assert.deepEqual(await tickXong(bai, gio - 2 * PHUT, gio), { xongSom: 0, ngayXong: 0 });
  assert.deepEqual(await tickXong(viec, null), { xongSom: 0, ngayXong: 0 }, 'ngay cu xong het van khong cong');
  assert.equal(await soDu('con_a'), 0);

  // Moc bat dau van duoc luu (bang chung cua phep so sanh), chi la khong cong diem.
  const [{ started_at }] = await rows(`SELECT started_at FROM assignments WHERE id = $1`, [bai]);
  assert.notEqual(started_at, null, 'van luu started_at du khong cong diem');
});

test('ngay tu score_since tro di: het bai tap ma con viec nha -> chua cong; tick not viec nha -> +10, dung mot lan', async () => {
  const NGAY = '2026-09-08';
  const bai = await themBai('con_a', NGAY);
  const viec = await themBai('con_a', NGAY, { chore: 'chr_1' });

  assert.deepEqual(await tickXong(bai, null), { xongSom: 0, ngayXong: 0 }, 'con viec nha chua tick');
  assert.deepEqual(await tickXong(viec, null), { xongSom: 0, ngayXong: DIEM_NGAY_XONG }, 'viec nha la dong cuoi -> +10');
  assert.equal(await soDu('con_a'), 10);

  // Con bo tick bai roi tick lai: ngay nay DA cong, khong cong nua (unique index)
  await db.query(`UPDATE assignments SET status = 'todo', completed_at = NULL WHERE id = $1`, [bai]);
  assert.deepEqual(await tickXong(bai, null), { xongSom: 0, ngayXong: 0 }, 'tick lai khong duoc +10 lan hai');
  assert.equal(await soDu('con_a'), 10, 'khong tru khi bo tick, khong cong them khi tick lai');

  const [{ n }] = await rows(
    `SELECT COUNT(*) AS n FROM score_events WHERE child_id = 'con_a' AND kind = 'day_complete' AND event_date = '${NGAY}'`
  );
  assert.equal(Number(n), 1);
});

test('chi co viec nha (bo me da xoa bai that) tick het -> KHONG cong 10 diem', async () => {
  const NGAY = '2026-09-09';
  const viec = await themBai('con_a', NGAY, { chore: 'chr_1' });
  assert.deepEqual(await tickXong(viec, null), { xongSom: 0, ngayXong: 0 });
});

test('xong som: bai 5 phut, bam Bat dau roi xong sau 4 phut -> +1; bo tick roi tick lai -> khong +1 nua', async () => {
  const NGAY = '2026-09-10';
  const bai = await themBai('con_b', NGAY, { phut: 5 });
  const batDau = Date.now() - 4 * PHUT;

  assert.deepEqual(await tickXong(bai, batDau), { xongSom: DIEM_XONG_SOM, ngayXong: DIEM_NGAY_XONG },
    'bai duy nhat cua ngay -> vua +1 xong som vua +10 ngay xong');
  assert.equal(await soDu('con_b'), 11);

  const [{ started_at }] = await rows(`SELECT started_at FROM assignments WHERE id = '${bai}'`);
  assert.ok(started_at, 'moc bat dau duoc luu lai cho bo me xem');

  await db.query(`UPDATE assignments SET status = 'todo', completed_at = NULL WHERE id = $1`, [bai]);
  assert.deepEqual(await tickXong(bai, Date.now() - 1 * PHUT), { xongSom: 0, ngayXong: 0 },
    'tick lai voi moc moi van khong duoc +1 lan hai (unique theo assignment_id)');
  assert.equal(await soDu('con_b'), 11);
});

test('xong som: qua gio -> khong +1; khong bam dong ho -> khong +1; viec nha co moc cung khong +1', async () => {
  const NGAY = '2026-09-11';
  const bai1 = await themBai('con_b', NGAY, { phut: 5 });
  const bai2 = await themBai('con_b', NGAY, { phut: 5 });
  const viec = await themBai('con_b', NGAY, { chore: 'chr_1', phut: 1 });

  assert.equal((await tickXong(bai1, Date.now() - 6 * PHUT)).xongSom, 0, 'qua gio');
  assert.equal((await tickXong(bai2, null)).xongSom, 0, 'khong bam dong ho');
  const kq = await tickXong(viec, Date.now() - 10_000);
  assert.equal(kq.xongSom, 0, 'viec nha khong bao gio duoc +1 du co moc');
  assert.equal(kq.ngayXong, DIEM_NGAY_XONG, 'nhung ngay van duoc +10 khi xong het');
});

test('ghi diem loi giua duong: con bam lai la cong not +1 va +10, khong cong trung', async () => {
  const NGAY = '2026-09-12';
  const bai = await themBai('con_c', NGAY, { phut: 5 });
  const truoc = await soDu('con_c');
  const gio = Date.now();

  // Cu tick THAT: chi chay cau danh dau xong (kem moc bat dau 4' truoc), roi buoc
  // cong diem nem loi giua duong (Neon rot ket noi) -> khong co dong score_events.
  // Cau tick la noi duy nhat ghi moc, nen bai kiem chinh dieu do: khong tu ghi
  // started_at vao hang.
  await danhDauXong(bai, gio - 4 * PHUT, gio);
  assert.equal(await soDu('con_c'), truoc, 'chua cong duoc diem nao');

  // Con thay bao loi va bam lai. Gia su may con da xoa moc trong localStorage
  // (truong hop xau nhat) nen lan nay khong gui moc: DB van con started_at +
  // completed_at cua cu tick truoc nen van xet duoc "xong som".
  await danhDauXong(bai, null, gio + 30_000);
  const [{ completed_at }] = await rows(`SELECT completed_at FROM assignments WHERE id = $1`, [bai]);
  assert.equal(new Date(completed_at as string).getTime(), gio,
    'bam lai KHONG day moc xong ra sau (COALESCE giu moc dau tien)');

  assert.deepEqual(await ghiDiem(bai), { xongSom: DIEM_XONG_SOM, ngayXong: DIEM_NGAY_XONG },
    'cong not ca +1 xong som va +10 ngay xong');
  assert.equal(await soDu('con_c'), truoc + DIEM_XONG_SOM + DIEM_NGAY_XONG);

  assert.deepEqual(await ghiDiem(bai), { xongSom: 0, ngayXong: 0 },
    'goi lai lan nua khong cong trung');
  assert.equal(await soDu('con_c'), truoc + DIEM_XONG_SOM + DIEM_NGAY_XONG);
});

test('bo me xoa dong cuoi con todo: ngay thanh hoan thanh -> +10, dung mot lan', async () => {
  const NGAY = '2026-09-13';
  const truoc = await soDu('con_c');
  const baiA = await themBai('con_c', NGAY);
  const baiB = await themBai('con_c', NGAY);

  // Con xong A, B con todo -> chua du dieu kien "ngay xong"
  assert.deepEqual(await tickXong(baiA, null), { xongSom: 0, ngayXong: 0 }, 'con B chua xong');
  assert.equal(await soDu('con_c'), truoc);

  // Bo me xoa B: con khong tick gi nua, nhung ngay do gio da xong het
  await db.query(`DELETE FROM assignments WHERE id = $1`, [baiB]);
  assert.deepEqual(await congDiemNgay('fam_cu', 'con_c', NGAY), { ngayXong: DIEM_NGAY_XONG, ngayTinhDiem: true });
  assert.equal(await soDu('con_c'), truoc + DIEM_NGAY_XONG);

  assert.deepEqual(await congDiemNgay('fam_cu', 'con_c', NGAY), { ngayXong: 0, ngayTinhDiem: true },
    'goi lai khong cong trung');
  assert.equal(await soDu('con_c'), truoc + DIEM_NGAY_XONG);

  // Bo me xoa NOT ca ngay -> khong con dong nao, khong cong gi (va khong no)
  await db.query(`DELETE FROM assignments WHERE id = $1`, [baiA]);
  assert.deepEqual(await congDiemNgay('fam_cu', 'con_c', NGAY), { ngayXong: 0, ngayTinhDiem: false });
  assert.equal(await soDu('con_c'), truoc + DIEM_NGAY_XONG, 'xoa bai khong lam mat diem da cong');
});

test('bo me doi dueDate roi khoi ngay cu: ngay CU thanh hoan thanh -> +10', async () => {
  const NGAY = '2026-09-14';
  const MAI = '2026-09-15';
  const truoc = await soDu('con_c');
  const baiA = await themBai('con_c', NGAY);
  const baiB = await themBai('con_c', NGAY);

  assert.deepEqual(await tickXong(baiA, null), { xongSom: 0, ngayXong: 0 });

  await db.query(`UPDATE assignments SET due_date = $2 WHERE id = $1`, [baiB, MAI]);
  assert.equal((await congDiemNgay('fam_cu', 'con_c', NGAY)).ngayXong, DIEM_NGAY_XONG,
    'ngay cu chi con bai A da xong -> +10');
  assert.equal((await congDiemNgay('fam_cu', 'con_c', MAI)).ngayXong, 0,
    'ngay moi con bai B todo -> chua cong');
  assert.equal(await soDu('con_c'), truoc + DIEM_NGAY_XONG);
});

test('congDiemNgay khong cong cho con cua nha khac', async () => {
  const NGAY = '2026-09-16';
  const truoc = await soDu('con_c');
  const bai = await themBai('con_c', NGAY);
  assert.deepEqual(await tickXong(bai, null), { xongSom: 0, ngayXong: DIEM_NGAY_XONG });

  await db.query(`DELETE FROM score_events WHERE child_id = 'con_c' AND event_date = $1`, [NGAY]);
  assert.deepEqual(await congDiemNgay('fam_moi', 'con_c', NGAY), { ngayXong: 0, ngayTinhDiem: false },
    'familyId khac -> khong thay dong nao, khong cong');
  assert.equal(await soDu('con_c'), truoc);
});

test('doi thuong: moi con MOT yeu cau dang cho; xin trung bi unique chan', async () => {
  await db.exec(
    `INSERT INTO rewards (id, family_id, name, icon, cost) VALUES ('rwd_kem', 'fam_cu', 'Ăn kem', '🍦', 5)`
  );
  await db.exec(
    `INSERT INTO reward_redemptions (id, child_id, reward_id, reward_name, reward_icon, cost)
     VALUES ('rdm_1', 'con_b', 'rwd_kem', 'Ăn kem', '🍦', 5)`
  );
  await assert.rejects(
    db.exec(
      `INSERT INTO reward_redemptions (id, child_id, reward_id, reward_name, reward_icon, cost)
       VALUES ('rdm_2', 'con_b', 'rwd_kem', 'Ăn kem', '🍦', 5)`
    ),
    /duplicate key|pending_once/,
    'yeu cau thu hai khi cai dau con cho phai bi chan'
  );
  // Con khac thi xin duoc binh thuong
  await db.exec(
    `INSERT INTO reward_redemptions (id, child_id, reward_id, reward_name, reward_icon, cost)
     VALUES ('rdm_a', 'con_a', 'rwd_kem', 'Ăn kem', '🍦', 5)`
  );
});

test('so du: dang cho KHONG tru; duyet thi tru; tu choi khong tru; duyet xong thi xin tiep duoc', async () => {
  const truoc = await soDu('con_b');
  assert.equal(truoc, 11 + 10, 'con_b: 11 (ngay 10) + 10 (ngay 11)');

  // Dang cho: chua tru
  assert.equal(await soDu('con_b'), truoc);

  // Duyet — dung cau UPDATE cua duyetDoiThuong (chi khi con pending)
  const duyet = await rows(
    `UPDATE reward_redemptions SET status = 'approved', decided_at = now()
      WHERE id = 'rdm_1' AND status = 'pending' RETURNING id`
  );
  assert.equal(duyet.length, 1);
  assert.equal(await soDu('con_b'), truoc - 5, 'duyet thi tru dung gia da chep');

  // Duyet lan hai (bo me bam hai lan) khong an gi
  const lanHai = await rows(
    `UPDATE reward_redemptions SET status = 'approved', decided_at = now()
      WHERE id = 'rdm_1' AND status = 'pending' RETURNING id`
  );
  assert.equal(lanHai.length, 0);
  assert.equal(await soDu('con_b'), truoc - 5);

  // Da duyet -> khong con pending -> xin tiep duoc
  await db.exec(
    `INSERT INTO reward_redemptions (id, child_id, reward_id, reward_name, reward_icon, cost)
     VALUES ('rdm_3', 'con_b', 'rwd_kem', 'Ăn kem', '🍦', 5)`
  );
  // Tu choi: khong tru
  await db.exec(`UPDATE reward_redemptions SET status = 'rejected', decided_at = now() WHERE id = 'rdm_3'`);
  assert.equal(await soDu('con_b'), truoc - 5);
});

test('xoa phan thuong: yeu cau giu nguyen ten/gia, reward_id ve NULL; so du khong doi', async () => {
  const truoc = await soDu('con_b');
  await db.exec(`DELETE FROM rewards WHERE id = 'rwd_kem'`);
  const [r] = await rows(`SELECT reward_id, reward_name, cost FROM reward_redemptions WHERE id = 'rdm_1'`);
  assert.equal(r.reward_id, null);
  assert.equal(r.reward_name, 'Ăn kem');
  assert.equal(Number(r.cost), 5);
  assert.equal(await soDu('con_b'), truoc, 'diem da tru van tru — lich su khong mat');
});

test('xoa bai da duoc +1: dong diem giu nguyen (assignment_id ve NULL), khong mat diem', async () => {
  const truoc = await soDu('con_b');
  const [e] = await rows(`SELECT id, assignment_id FROM score_events WHERE child_id = 'con_b' AND kind = 'early_finish'`);
  await db.query(`DELETE FROM assignments WHERE id = $1`, [e.assignment_id]);
  const [sau] = await rows(`SELECT assignment_id FROM score_events WHERE id = $1`, [e.id]);
  assert.equal(sau.assignment_id, null);
  assert.equal(await soDu('con_b'), truoc);
});

test('xoa con: diem va yeu cau doi thuong di theo (CASCADE), khong con dong mo coi', async () => {
  await db.exec(`DELETE FROM children WHERE id = 'con_a'`);
  const [{ n1 }] = await rows(`SELECT COUNT(*) AS n1 FROM score_events WHERE child_id = 'con_a'`);
  const [{ n2 }] = await rows(`SELECT COUNT(*) AS n2 FROM reward_redemptions WHERE child_id = 'con_a'`);
  assert.equal(Number(n1), 0);
  assert.equal(Number(n2), 0);
});

test('score_events chan diem am va kind la (CHECK)', async () => {
  await assert.rejects(
    db.exec(`INSERT INTO score_events (id, child_id, kind, points, event_date) VALUES ('x1', 'con_b', 'day_complete', -3, '2026-09-12')`),
    /check/i
  );
  await assert.rejects(
    db.exec(`INSERT INTO score_events (id, child_id, kind, points, event_date) VALUES ('x2', 'con_b', 'bonus', 3, '2026-09-12')`),
    /check/i
  );
});
