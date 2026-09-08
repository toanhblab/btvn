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
 *   8. Sao cua NHIEM VU (issue #42, migration 016): dong viec nha co stars tick
 *      xong duoc +stars, cong THEM vao +10; mot lan cho moi dong (tick lai, bo
 *      tick roi tick lai, hai request cung luc); bo tick khong rut; dong viec
 *      nha cu (stars NULL) khong bao gio duoc; xoa dong khong mat sao da cong.
 *   9. Bo me TRU diem (issue #43, migration 017): moi lan tru la mot dong
 *      score_penalties voi DUNG so DA TRU lan do + ly do; so du KHONG BAO GIO am
 *      va lan tru KHONG BAO GIO qua so bo me go — go qua so du thi kep vao so du
 *      (LEAST), so du TANG giua luc mo man va luc bam thi van chi tru so da go,
 *      hai request cung luc thi ben sau chi tru phan con lai, het ⭐ moi tu choi;
 *      ba luat cong khong doi; xoa con keo theo; nha khac khong tru duoc.
 *  10. HAI duong tru ⭐ (bo me tru, va duyet doi thuong) xep hang o CUNG mot
 *      khoa theo con: duyet + tru cung luc chi mot ben di qua, so du khong xuong
 *      duoi 0; bo va me cung bam Duyet thi ben sau bao "da xu ly roi" (409) chu
 *      khong bao "chua du diem". Kem nut cua o tru ⭐ (trangThaiTruDiem): go qua
 *      so du la moi "Tru het N", khong phai nut khoa.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { chayMigrations } from '../scripts/db.mjs';
import {
  DIEM_NGAY_XONG, DIEM_XONG_SOM, ngayDuocTinhDiem, ngayHoanThanh, xongSom,
} from './diem.ts';
import { SQL_TAO_NHIEM_VU_NGAY } from './sqlNhiemVu.ts';
import {
  SQL_DUYET_DOI_THUONG, SQL_KHOA_TRU_DIEM, SQL_SO_DU_CON, SQL_SO_DU_MOT_CON,
  SQL_TRANG_THAI_DOI_THUONG, SQL_TRU_DIEM,
} from './sqlDiem.ts';
import { trangThaiTruDiem } from './types.ts';

const TEP_015 = '015_tinh_diem_doi_thuong.sql';
const PHUT = 60_000;

let db: PGlite;
let boChay: { query: (t: string, p?: unknown[]) => Promise<Record<string, unknown>[]> };

const rows = async (sql: string, params: unknown[] = []) =>
  (await db.query(sql, params)).rows as Record<string, unknown>[];

/**
 * Ngay tinh TU `CURRENT_DATE` cua PGlite — cung nguon voi hang rao
 * "ngay >= hom nay" cua `taoNhiemVuNeuChuaQua`.
 *
 * Nhung test di qua hang rao do KHONG duoc ghim ngay theo lich ('2026-09-25'):
 * lich troi qua la ngay do thanh QUA KHU, hang rao bo qua, va test do ma khong
 * co gi trong ma doi. Cac test KHAC trong tep nay ghim ngay that duoc vi
 * `score_since` cua `fam_cu` cung bi ghim ('2026-09-08', xem before()).
 */
const ngayTuHomNay = async (lech: number): Promise<string> => {
  const [r] = await rows(`SELECT (CURRENT_DATE + $1::int)::text AS d`, [lech]);
  return String(r.d);
};

let dem = 0;
const id = (p: string) => `${p}_${++dem}`;

/** So du — CUNG cau SQL_SO_DU_CON voi soDiemTheoCon (lib/store.ts), qua lib/sqlDiem.ts. */
async function soDu(childId: string): Promise<number> {
  const [r] = await rows(
    `SELECT ${SQL_SO_DU_CON} AS points FROM children c WHERE c.id = $1`,
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
            started_at, completed_at, stars
       FROM assignments WHERE id = $1`,
    [asgId]
  );
  const kq = { xongSom: 0, ngayXong: 0, nhiemVu: 0 };
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

  // Buoc 3 cua ghiDiemSauKhiXong: sao cua nhiem vu (dong viec nha CO stars).
  const stars = a.stars === null ? null : Number(a.stars);
  if (ngay.ngayTinhDiem && a.chore_id !== null && stars !== null && stars > 0) {
    const ins = await rows(
      `INSERT INTO score_events (id, child_id, kind, points, event_date, assignment_id)
       VALUES ($1, $2, 'task_done', $3, $4, $5)
       ON CONFLICT (assignment_id) WHERE kind = 'task_done' DO NOTHING
       RETURNING id`,
      [id('sce'), a.child_id, stars, a.due_date, asgId]
    );
    if (ins.length > 0) kq.nhiemVu = stars;
  }
  return kq;
}

/**
 * Ca cu tick cua con: danh dau xong luc `nowMs` kem moc bat dau `startedAtMs`
 * (null = khong bam dong ho), roi route ghi diem.
 */
async function tickXong(
  asgId: string,
  startedAtMs: number | null,
  nowMs = Date.now(),
  familyId = 'fam_cu'
) {
  await danhDauXong(asgId, startedAtMs, nowMs);
  return ghiDiem(asgId, familyId);
}

/** `sao` = stars cua dong nhiem vu (chep tu cau hinh luc tao); bo trong = NULL = dong cu / bai that. */
async function themBai(
  childId: string,
  dueDate: string,
  opts: { chore?: string; phut?: number; sao?: number } = {}
) {
  const asg = id('asg');
  await db.query(
    `INSERT INTO assignments (id, child_id, subject, content, due_date, status, chore_id, duration_minutes, stars)
     VALUES ($1, $2, 'Toán', 'bài', $3, 'todo', $4, $5, $6)`,
    [asg, childId, dueDate, opts.chore ?? null, opts.phut ?? 10, opts.sao ?? null]
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

  // Nha rieng cho nhom test "bo me chon ngay" (nhap bai / doi han chot): nhung
  // test do phai dung ngay tinh tu CURRENT_DATE vi di qua hang rao ngay-da-qua,
  // nen `score_since` phai cu hon hom nay, va moi test mot con de khong dung
  // cham (child_id, event_date) cua nhau.
  await db.exec(
    `INSERT INTO families (id, name, slug, parent_pin_hash, score_since)
       VALUES ('fam_han', 'Nhà hạn chót', 'nha-han', 'h8', CURRENT_DATE - 60);
     INSERT INTO children (id, family_id, name, grade, color, avatar_url) VALUES
       ('han1', 'fam_han', 'H1', 'Lớp 1', 'primary', '/h1.png'),
       ('han2', 'fam_han', 'H2', 'Lớp 1', 'secondary', '/h2.png'),
       ('han3', 'fam_han', 'H3', 'Lớp 1', 'tertiary', '/h3.png'),
       ('han4', 'fam_han', 'H4', 'Lớp 1', 'primary', '/h4.png');
     INSERT INTO daily_chores (id, family_id, content, sort_order)
       VALUES ('chr_han', 'fam_han', 'Tắt đèn', 1)`
  );
  const NGAY_CU = '2026-09-07';
  const bai = await themBai('con_a', NGAY_CU, { phut: 10 });
  const viec = await themBai('con_a', NGAY_CU, { chore: 'chr_1' });

  // Tick kem moc bat dau 2' truoc: xong som THAT (10' cho bai 10'), nhung ngay
  // nay truoc score_since nen khong duoc +1 — luat khong hoi to ap cho ca hai loai.
  const gio = Date.now();
  assert.deepEqual(await tickXong(bai, gio - 2 * PHUT, gio), { xongSom: 0, ngayXong: 0, nhiemVu: 0 });
  assert.deepEqual(await tickXong(viec, null), { xongSom: 0, ngayXong: 0, nhiemVu: 0 }, 'ngay cu xong het van khong cong');
  assert.equal(await soDu('con_a'), 0);

  // Moc bat dau van duoc luu (bang chung cua phep so sanh), chi la khong cong diem.
  const [{ started_at }] = await rows(`SELECT started_at FROM assignments WHERE id = $1`, [bai]);
  assert.notEqual(started_at, null, 'van luu started_at du khong cong diem');
});

test('ngay tu score_since tro di: het bai tap ma con viec nha -> chua cong; tick not viec nha -> +10, dung mot lan', async () => {
  const NGAY = '2026-09-08';
  const bai = await themBai('con_a', NGAY);
  const viec = await themBai('con_a', NGAY, { chore: 'chr_1' });

  assert.deepEqual(await tickXong(bai, null), { xongSom: 0, ngayXong: 0, nhiemVu: 0 }, 'con viec nha chua tick');
  assert.deepEqual(await tickXong(viec, null), { xongSom: 0, ngayXong: DIEM_NGAY_XONG, nhiemVu: 0 }, 'viec nha la dong cuoi -> +10');
  assert.equal(await soDu('con_a'), 10);

  // Con bo tick bai roi tick lai: ngay nay DA cong, khong cong nua (unique index)
  await db.query(`UPDATE assignments SET status = 'todo', completed_at = NULL WHERE id = $1`, [bai]);
  assert.deepEqual(await tickXong(bai, null), { xongSom: 0, ngayXong: 0, nhiemVu: 0 }, 'tick lai khong duoc +10 lan hai');
  assert.equal(await soDu('con_a'), 10, 'khong tru khi bo tick, khong cong them khi tick lai');

  const [{ n }] = await rows(
    `SELECT COUNT(*) AS n FROM score_events WHERE child_id = 'con_a' AND kind = 'day_complete' AND event_date = '${NGAY}'`
  );
  assert.equal(Number(n), 1);
});

test('chi co viec nha (bo me da xoa bai that) tick het -> KHONG cong 10 diem', async () => {
  const NGAY = '2026-09-09';
  const viec = await themBai('con_a', NGAY, { chore: 'chr_1' });
  assert.deepEqual(await tickXong(viec, null), { xongSom: 0, ngayXong: 0, nhiemVu: 0 });
});

test('xong som: bai 5 phut, bam Bat dau roi xong sau 4 phut -> +1; bo tick roi tick lai -> khong +1 nua', async () => {
  const NGAY = '2026-09-10';
  const bai = await themBai('con_b', NGAY, { phut: 5 });
  const batDau = Date.now() - 4 * PHUT;

  assert.deepEqual(await tickXong(bai, batDau), { xongSom: DIEM_XONG_SOM, ngayXong: DIEM_NGAY_XONG, nhiemVu: 0 },
    'bai duy nhat cua ngay -> vua +1 xong som vua +10 ngay xong');
  assert.equal(await soDu('con_b'), 11);

  const [{ started_at }] = await rows(`SELECT started_at FROM assignments WHERE id = '${bai}'`);
  assert.ok(started_at, 'moc bat dau duoc luu lai cho bo me xem');

  await db.query(`UPDATE assignments SET status = 'todo', completed_at = NULL WHERE id = $1`, [bai]);
  assert.deepEqual(await tickXong(bai, Date.now() - 1 * PHUT), { xongSom: 0, ngayXong: 0, nhiemVu: 0 },
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

  assert.deepEqual(await ghiDiem(bai), { xongSom: DIEM_XONG_SOM, ngayXong: DIEM_NGAY_XONG, nhiemVu: 0 },
    'cong not ca +1 xong som va +10 ngay xong');
  assert.equal(await soDu('con_c'), truoc + DIEM_XONG_SOM + DIEM_NGAY_XONG);

  assert.deepEqual(await ghiDiem(bai), { xongSom: 0, ngayXong: 0, nhiemVu: 0 },
    'goi lai lan nua khong cong trung');
  assert.equal(await soDu('con_c'), truoc + DIEM_XONG_SOM + DIEM_NGAY_XONG);
});

test('bo me xoa dong cuoi con todo: ngay thanh hoan thanh -> +10, dung mot lan', async () => {
  const NGAY = '2026-09-13';
  const truoc = await soDu('con_c');
  const baiA = await themBai('con_c', NGAY);
  const baiB = await themBai('con_c', NGAY);

  // Con xong A, B con todo -> chua du dieu kien "ngay xong"
  assert.deepEqual(await tickXong(baiA, null), { xongSom: 0, ngayXong: 0, nhiemVu: 0 }, 'con B chua xong');
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

  assert.deepEqual(await tickXong(baiA, null), { xongSom: 0, ngayXong: 0, nhiemVu: 0 });

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
  assert.deepEqual(await tickXong(bai, null), { xongSom: 0, ngayXong: DIEM_NGAY_XONG, nhiemVu: 0 });

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

/* ---------------- Sao cua nhiem vu hang ngay (issue #42, migration 016) ---------------- */

test('nhiem vu co sao: tick xong -> +stars (cong THEM vao +10 khi la dong cuoi), dung mot lan', async () => {
  const NGAY = '2026-09-20';
  const truoc = await soDu('con_b');
  const bai = await themBai('con_b', NGAY);
  const viec = await themBai('con_b', NGAY, { chore: 'chr_1', sao: 3 });

  assert.deepEqual(await tickXong(viec, null), { xongSom: 0, ngayXong: 0, nhiemVu: 3 },
    'tick nhiem vu 3 sao -> +3 ngay, ngay chua xong (con bai)');
  assert.equal(await soDu('con_b'), truoc + 3);

  assert.deepEqual(await tickXong(bai, null), { xongSom: 0, ngayXong: DIEM_NGAY_XONG, nhiemVu: 0 },
    'bai that la dong cuoi -> +10; bai that khong co sao nhiem vu');
  assert.equal(await soDu('con_b'), truoc + 3 + DIEM_NGAY_XONG, 'sao cong THEM, luat +10 giu nguyen');

  // Tick lai dong nhiem vu (con bam lien tay): khong cong lan hai
  assert.deepEqual(await ghiDiem(viec), { xongSom: 0, ngayXong: 0, nhiemVu: 0 }, 'tick lai khong cong');
  assert.equal(await soDu('con_b'), truoc + 3 + DIEM_NGAY_XONG);
});

test('bo tick nhiem vu: KHONG rut sao; tick lai: khong cong lan hai (unique index)', async () => {
  const NGAY = '2026-09-21';
  const truoc = await soDu('con_b');
  const viec = await themBai('con_b', NGAY, { chore: 'chr_1', sao: 2 });

  assert.equal((await tickXong(viec, null)).nhiemVu, 2);
  assert.equal(await soDu('con_b'), truoc + 2);

  // Bo tick (setStatus done = false)
  await db.query(`UPDATE assignments SET status = 'todo', completed_at = NULL WHERE id = $1`, [viec]);
  assert.deepEqual(await ghiDiem(viec), { xongSom: 0, ngayXong: 0, nhiemVu: 0 }, 'dang todo thi khong ghi gi');
  assert.equal(await soDu('con_b'), truoc + 2, 'bo tick khong rut sao (Q6)');

  // Tick lai
  assert.deepEqual(await tickXong(viec, null), { xongSom: 0, ngayXong: 0, nhiemVu: 0 }, 'tick lai khong duoc +2 lan hai');
  assert.equal(await soDu('con_b'), truoc + 2);

  const [{ n }] = await rows(
    `SELECT COUNT(*) AS n FROM score_events WHERE assignment_id = $1 AND kind = 'task_done'`, [viec]
  );
  assert.equal(Number(n), 1, 'dung MOT dong task_done cho dong nhiem vu nay');
});

test('hai request tick cung luc cho cung mot nhiem vu: chi MOT ben cong sao', async () => {
  const NGAY = '2026-09-22';
  const truoc = await soDu('con_b');
  const viec = await themBai('con_b', NGAY, { chore: 'chr_1', sao: 5 });
  await danhDauXong(viec, null, Date.now());

  // Hai lan ghi diem chay dong thoi (PGlite noi tiep chung, nhung ca hai deu
  // di qua cung mot cau INSERT ... ON CONFLICT DO NOTHING RETURNING — ben nao
  // vao sau thi RETURNING rong). Tren Neon that thi day la hai request that.
  const [a, b] = await Promise.all([ghiDiem(viec), ghiDiem(viec)]);
  assert.deepEqual([a.nhiemVu, b.nhiemVu].sort(), [0, 5], 'dung mot trong hai ben duoc +5');
  assert.equal(await soDu('con_b'), truoc + 5);
});

test('dong viec nha CU (stars NULL — tao truoc migration 016) tick xong KHONG duoc sao (khong hoi to)', async () => {
  const NGAY = '2026-09-23';
  const truoc = await soDu('con_b');
  const viecCu = await themBai('con_b', NGAY, { chore: 'chr_1' });   // stars NULL
  const bai = await themBai('con_b', NGAY);

  assert.deepEqual(await tickXong(viecCu, null), { xongSom: 0, ngayXong: 0, nhiemVu: 0 }, 'khong co sao de cong');
  assert.deepEqual(await tickXong(bai, null), { xongSom: 0, ngayXong: DIEM_NGAY_XONG, nhiemVu: 0 },
    'nhung ngay van duoc +10 nhu cu — dong cu van tinh vao "ngay xong"');
  assert.equal(await soDu('con_b'), truoc + DIEM_NGAY_XONG);
  const [{ n }] = await rows(`SELECT COUNT(*) AS n FROM score_events WHERE assignment_id = $1`, [viecCu]);
  assert.equal(Number(n), 0);
});

test('nhiem vu cua ngay TRUOC score_since: khong duoc sao (khong hoi to ap ca cho task_done)', async () => {
  const [{ score_since }] = await rows(`SELECT score_since::text AS score_since FROM families WHERE id = 'fam_cu'`);
  const NGAY_CU = '2026-01-01';
  assert.ok(NGAY_CU < String(score_since));
  const truoc = await soDu('con_b');
  const viec = await themBai('con_b', NGAY_CU, { chore: 'chr_1', sao: 4 });
  assert.deepEqual(await tickXong(viec, null), { xongSom: 0, ngayXong: 0, nhiemVu: 0 });
  assert.equal(await soDu('con_b'), truoc);
});

test('xoa dong nhiem vu da cong sao: dong diem giu nguyen (assignment_id ve NULL), so du khong doi', async () => {
  const NGAY = '2026-09-24';
  const truoc = await soDu('con_b');
  const viec = await themBai('con_b', NGAY, { chore: 'chr_1', sao: 2 });
  assert.equal((await tickXong(viec, null)).nhiemVu, 2);
  await db.query(`DELETE FROM assignments WHERE id = $1`, [viec]);
  const [e] = await rows(`SELECT assignment_id FROM score_events WHERE kind = 'task_done' AND child_id = 'con_b' AND event_date = $1`, [NGAY]);
  assert.equal(e.assignment_id, null);
  assert.equal(await soDu('con_b'), truoc + 2, 'sao da cong khong mat');

  // Hai dong task_done co assignment_id NULL khong dam nhau (unique index bo qua NULL)
  const viec2 = await themBai('con_b', NGAY, { chore: 'chr_1', sao: 1 });
  assert.equal((await tickXong(viec2, null)).nhiemVu, 1);
  await db.query(`DELETE FROM assignments WHERE id = $1`, [viec2]);
  assert.equal(await soDu('con_b'), truoc + 3);
});

/**
 * Mo phong HAI buoc cua saveSubmission (lib/store.ts) cho mot (con, ngay): tao
 * cac dong bai THAT, roi goi taoNhiemVuNgay cho DUNG ngay do — ke ca ngay mai.
 *
 * Cau `INSERT ... SELECT` duoi day la ban NHAN BAN cua taoNhiemVuNgay; xem
 * AGENTS.md de biet cac ban khac phai sua kem.
 */
/** Chay CHINH cau SQL cua taoNhiemVuNgay (lib/sqlNhiemVu.ts), cho mot con. */
async function taoNhiemVuNgay(familyId: string, dueDate: string, childId: string) {
  await db.query(SQL_TAO_NHIEM_VU_NGAY, [familyId, dueDate, 'Việc nhà', 'primary_school', 10, [childId]]);
}

async function giaoBai(
  familyId: string,
  childId: string,
  dueDate: string,
  opts: { taoNhiemVu?: boolean } = {}
) {
  const bai = await themBai(childId, dueDate);
  if (opts.taoNhiemVu !== false) await taoNhiemVuNeuChuaQua(familyId, dueDate, childId);
  return bai;
}

/**
 * Mo phong `taoNhiemVuNgayNeuChuaQua` (lib/store.ts): hai duong bo me tu chon
 * ngay (nhap bai, doi han chot) chi tao dong nhiem vu cho ngay TU HOM NAY TRO DI.
 */
async function taoNhiemVuNeuChuaQua(familyId: string, dueDate: string, childId: string) {
  const [{ hom_nay }] = await rows(`SELECT CURRENT_DATE::text AS hom_nay`);
  if (dueDate < String(hom_nay)) return;
  await taoNhiemVuNgay(familyId, dueDate, childId);
}

/**
 * HANG RAO +10 CUA NGAY MAI — ly do duy nhat con lai de giu loi goi
 * taoNhiemVuNgay trong saveSubmission (chu thich o lib/store.ts tro tới day).
 *
 * `congDiemNgayNeuXong` KHONG kiem "ngay do da toi chua": no chi hoi "moi dong
 * cua (con, ngay do) da done chua". Bo me nhap bai cho NGAY MAI toi nay, con lam
 * het bai ngay mai ngay toi nay (duoc phep — man cua con ve bai ngay mai duoi
 * tieu de "Ngày mai" va cho tick). Cai duy nhat chan +10 cua ngay mai cong som
 * la dong nhiem vu 'todo' cua ngay mai da duoc tao san.
 *
 * Nhanh thu hai chay CUNG kich ban nhung KHONG tao dong nhiem vu, de thay ro
 * cai gia: +10 cua ngay mai cong ngay toi nay, va sang mai con tick het nhiem vu
 * cung khong con gi de cong (unique index theo (child_id, event_date)).
 */
test('bai cua NGAY MAI lam xong toi nay: dong nhiem vu ngay mai da tao san chan +10 cong som', async () => {
  const NGAY_MAI = await ngayTuHomNay(1);
  const bai = await giaoBai('fam_han', 'han1', NGAY_MAI);

  const nv = await rows(
    `SELECT id, status FROM assignments
      WHERE child_id = 'han1' AND due_date = $1 AND chore_id IS NOT NULL`,
    [NGAY_MAI]
  );
  assert.equal(nv.length, 1, 'saveSubmission tao san dong nhiem vu cua ngay mai');
  assert.equal(nv[0].status, 'todo', 'dong do dang todo — chinh no la hang rao');

  const truoc = await soDu('han1');
  assert.deepEqual(
    await tickXong(bai, null, undefined, 'fam_han'),
    { xongSom: 0, ngayXong: 0, nhiemVu: 0 },
    'lam het BAI cua ngay mai toi nay van chua duoc +10: nhiem vu ngay mai chua tick'
  );
  assert.equal(await soDu('han1'), truoc, 'khong cong dong diem nao truoc han');

  // Sang mai con tick not nhiem vu -> luc do moi +10, kem ⭐ cua chinh nhiem vu
  // (taoNhiemVuNgay chep dc.stars = 1 vao dong, xem migration 016).
  assert.deepEqual(
    await tickXong(String(nv[0].id), null, undefined, 'fam_han'),
    { xongSom: 0, ngayXong: DIEM_NGAY_XONG, nhiemVu: 1 },
    'tick not nhiem vu cua ngay do -> +10 va +1 ⭐ cua nhiem vu'
  );
  assert.equal(await soDu('han1'), truoc + DIEM_NGAY_XONG + 1);
});

/**
 * Mo phong duong bo me DOI HAN CHOT: `updateAssignment` ghi due_date moi, roi
 * route goi `xuLySauKhiDoiHanChot` (lib/store.ts) — hai buoc cua ham do la tao
 * dong nhiem vu cho ngay MOI khi ngay do tu hom nay tro di (hang rao +10), va
 * xet lai ngay CU vua bot mot dong.
 */
async function doiNgay(
  familyId: string,
  asgId: string,
  ngayMoi: string,
  opts: { taoNhiemVu?: boolean } = {}
) {
  const [truoc] = await rows(
    `SELECT child_id, due_date::text AS due_date FROM assignments WHERE id = $1`,
    [asgId]
  );
  await db.query(`UPDATE assignments SET due_date = $2::date WHERE id = $1`, [asgId, ngayMoi]);
  if (opts.taoNhiemVu !== false) {
    await taoNhiemVuNeuChuaQua(familyId, ngayMoi, String(truoc.child_id));
  }
  const cu = await congDiemNgay(familyId, String(truoc.child_id), String(truoc.due_date));
  const moi = await congDiemNgay(familyId, String(truoc.child_id), ngayMoi);
  return { cu, moi };
}

/**
 * Duong THU HAI toi cung cai bay "+10 cua ngay mai cong som": bo me khong nhap
 * bai moi ma DOI HAN CHOT mot bai san sang ngay mai (o input date cua
 * /bome/bai/<id>, khong chan ngay tuong lai). Luc do saveSubmission khong chay,
 * nen `xuLySauKhiDoiHanChot` phai tu tao dong nhiem vu cho ngay MOI — khong thi
 * tap dong cua ngay mai chi con mot bai, con lam xong toi nay la +10 cua ngay
 * mai bay ra.
 */
test('bo me doi han chot sang NGAY MAI: ngay moi cung co dong nhiem vu gac +10', async () => {
  const HOM_NAY = await ngayTuHomNay(0);
  const NGAY_MAI = await ngayTuHomNay(1);
  const bai = await giaoBai('fam_han', 'han2', HOM_NAY);

  const truoc = await soDu('han2');
  await doiNgay('fam_han', bai, NGAY_MAI);

  const nv = await rows(
    `SELECT id, status FROM assignments
      WHERE child_id = 'han2' AND due_date = $1 AND chore_id IS NOT NULL`,
    [NGAY_MAI]
  );
  assert.equal(nv.length, 1, 'ngay MOI phai co dong nhiem vu cua no');
  assert.equal(nv[0].status, 'todo');

  assert.deepEqual(
    await tickXong(bai, null, undefined, 'fam_han'),
    { xongSom: 0, ngayXong: 0, nhiemVu: 0 },
    'lam xong bai cua ngay mai ngay toi nay: chua duoc +10, nhiem vu ngay mai con todo'
  );
  assert.equal(await soDu('han2'), truoc, 'khong cong som dong nao');

  assert.deepEqual(
    await tickXong(String(nv[0].id), null, undefined, 'fam_han'),
    { xongSom: 0, ngayXong: DIEM_NGAY_XONG, nhiemVu: 1 },
    'tick not nhiem vu cua ngay do -> +10 va +1 ⭐'
  );
  assert.equal(await soDu('han2'), truoc + DIEM_NGAY_XONG + 1);
});

test('bo me doi han chot: ngay CU bot mot dong nen thanh hoan thanh -> +10 cho ngay cu', async () => {
  const NGAY_CU = await ngayTuHomNay(0);
  const NGAY_MOI = await ngayTuHomNay(1);
  // Ngay cu co hai bai + dong nhiem vu; con lam xong het TRU bai se bi doi ngay.
  const bai1 = await giaoBai('fam_han', 'han3', NGAY_CU);
  const bai2 = await themBai('han3', NGAY_CU);
  const nvCu = await rows(
    `SELECT id FROM assignments
      WHERE child_id = 'han3' AND due_date = $1 AND chore_id IS NOT NULL`,
    [NGAY_CU]
  );
  await tickXong(bai1, null, undefined, 'fam_han');
  const kqNhiemVu = await tickXong(String(nvCu[0].id), null, undefined, 'fam_han');
  assert.equal(kqNhiemVu.ngayXong, 0, 'con bai2 chua xong nen ngay cu chua hoan thanh');

  const truoc = await soDu('han3');
  const kq = await doiNgay('fam_han', bai2, NGAY_MOI);
  assert.equal(kq.cu.ngayXong, DIEM_NGAY_XONG, 'bot bai2 di la ngay CU xong het -> +10');
  assert.equal(await soDu('han3'), truoc + DIEM_NGAY_XONG);
});

test('doi han chot ve mot ngay DA QUA: khong tao dong nhiem vu cho ngay do', async () => {
  // Ngay da qua thi khong con gi phai gac (khong the cong +10 som cho no nua),
  // ma them dong 'todo' con khong co duong nao tick (man cua con liet ke tu hom
  // nay tro di) la khoa luon +10 cua ngay do.
  const NGAY_QUA = await ngayTuHomNay(-10);
  const bai = await giaoBai('fam_han', 'han4', await ngayTuHomNay(1));
  await doiNgay('fam_han', bai, NGAY_QUA);

  const nv = await rows(
    `SELECT id FROM assignments
      WHERE child_id = 'han4' AND due_date = $1 AND chore_id IS NOT NULL`,
    [NGAY_QUA]
  );
  assert.deepEqual(nv, [], 'khong sinh dong nhiem vu nao cho ngay da qua');
});

test('cai gia neu KHONG tao san dong nhiem vu cua ngay mai: +10 cong som mot ngay', async () => {
  const NGAY_MAI = '2026-09-26';
  const bai = await giaoBai('fam_cu', 'con_c', NGAY_MAI, { taoNhiemVu: false });

  const truoc = await soDu('con_c');
  assert.deepEqual(
    await tickXong(bai, null),
    { xongSom: 0, ngayXong: DIEM_NGAY_XONG, nhiemVu: 0 },
    'khong co dong nhiem vu nao -> tap dong cua ngay mai chi co bai -> +10 ngay toi nay'
  );
  assert.equal(await soDu('con_c'), truoc + DIEM_NGAY_XONG);

  // Sang mai tao luoi moi sinh dong nhiem vu; con tick het cung khong con gi de
  // cong vi (con, ngay) da co dong day_complete.
  await db.query(
    `INSERT INTO assignments (id, child_id, subject, content, due_date, status, chore_id, stars)
     VALUES ($1, 'con_c', 'Việc nhà', 'Tắt đèn', $2, 'todo', 'chr_1', 1)`,
    [id('asg'), NGAY_MAI]
  );
  const nv = await rows(
    `SELECT id FROM assignments
      WHERE child_id = 'con_c' AND due_date = $1 AND chore_id IS NOT NULL`,
    [NGAY_MAI]
  );
  assert.deepEqual(
    await tickXong(String(nv[0].id), null),
    { xongSom: 0, ngayXong: 0, nhiemVu: 1 },
    'chi con ⭐ cua rieng nhiem vu; +10 cua ngay do da bi an truoc khi lam nhiem vu'
  );
  assert.equal(
    await soDu('con_c'),
    truoc + DIEM_NGAY_XONG + 1,
    'con an +10 cho mot ngay ma luc cong chua lam nhiem vu nao'
  );
});

/**
 * Duong nhap bai BU cho mot ngay DA QUA (o date cua /bome/them khong co `min`,
 * bo me chon duoc ngay hom qua). Neu tao dong nhiem vu cho ngay do thi nhiem vu
 * VUA THEM sinh ra mot dong 'todo' cho mot ngay ma man cua con khong con ve
 * (liet ke tu hom nay) — khong ai tick duoc, va ngay do khong bao gio "xong het"
 * nua, tuc +10 cua ngay do bi khoa mai mai.
 *
 * Nha rieng voi `score_since` cu (30 ngay truoc) de ngay hom qua VAN duoc tinh
 * diem — khong thi cua chan "khong hoi to" da loai truoc, khong thay duoc gi.
 */
/**
 * Ngay MOI vua NHAN mot dong da 'done' co the vua thanh "xong het" — luc do
 * khong con cu tick nao de kich +10 (cong diem theo su kien, khong co cron), nen
 * `xuLySauKhiDoiHanChot` phai xet lai CA ngay moi, khong chi ngay cu.
 *
 * Kich ban cuoi tuan cua nha captain: hom nay con khong co bai that, da tick het
 * nhiem vu (chi duoc ⭐ tung nhiem vu, chua +10 vi `ngayHoanThanh` doi >= 1 bai
 * that). Bo me doi han mot bai con DA LAM XONG ve hom nay -> hom nay du dieu kien.
 */
test('doi han chot mot bai DA XONG ve ngay co san nhiem vu da tick: ngay MOI duoc +10', async () => {
  const HOM_NAY = '2026-10-05';
  const NGAY_SAU = '2026-10-06';

  // Hom nay: chi co nhiem vu, con da tick het -> chua +10.
  await taoNhiemVuNgay('fam_cu', HOM_NAY, 'con_c');
  const nvHomNay = await rows(
    `SELECT id FROM assignments
      WHERE child_id = 'con_c' AND due_date = $1 AND chore_id IS NOT NULL`,
    [HOM_NAY]
  );
  assert.equal(nvHomNay.length, 1, 'hom nay co dong nhiem vu');
  const kqNv = await tickXong(String(nvHomNay[0].id), null);
  assert.equal(kqNv.ngayXong, 0, 'ngay chi co nhiem vu thi khong +10 (doi >= 1 bai that)');

  // Mot bai cua NGAY SAU ma con da lam xong som.
  const bai = await themBai('con_c', NGAY_SAU);
  await tickXong(bai, null);

  // Bo me doi han bai do ve HOM NAY -> hom nay = 1 bai done + 1 nhiem vu done.
  const truoc = await soDu('con_c');
  const kq = await doiNgay('fam_cu', bai, HOM_NAY);
  assert.equal(kq.moi.ngayXong, DIEM_NGAY_XONG, 'ngay MOI vua thanh xong het -> +10');
  assert.equal(await soDu('con_c'), truoc + DIEM_NGAY_XONG);

  // Goi lai (idempotent nho unique index): khong cong lan hai.
  const lai = await congDiemNgay('fam_cu', 'con_c', HOM_NAY);
  assert.equal(lai.ngayXong, 0);
  assert.equal(await soDu('con_c'), truoc + DIEM_NGAY_XONG);
});

test('nhap bai bu cho ngay DA QUA: khong sinh dong nhiem vu, ngay do van cong duoc +10', async () => {
  await db.exec(
    `INSERT INTO families (id, name, slug, parent_pin_hash, score_since)
     VALUES ('fam_bu', 'Nhà bù', 'nha-bu', 'h9', CURRENT_DATE - 30);
     INSERT INTO children (id, family_id, name, grade, color, avatar_url)
     VALUES ('con_bu', 'fam_bu', 'Bù', 'Lớp 1', 'primary', '/bu.png');
     INSERT INTO daily_chores (id, family_id, content, sort_order)
     VALUES ('chr_bu', 'fam_bu', 'Tắt đèn', 1)`
  );
  const [{ hom_qua, hom_kia }] = await rows(
    `SELECT (CURRENT_DATE - 1)::text AS hom_qua, (CURRENT_DATE - 2)::text AS hom_kia`
  );

  // Bo me nhap bu mot bai cho HOM QUA.
  const bai = await giaoBai('fam_bu', 'con_bu', String(hom_qua));
  assert.deepEqual(
    await rows(
      `SELECT id FROM assignments
        WHERE child_id = 'con_bu' AND due_date = $1 AND chore_id IS NOT NULL`,
      [hom_qua]
    ),
    [],
    'khong sinh dong nhiem vu nao cho ngay da qua'
  );

  const truoc = await soDu('con_bu');
  assert.deepEqual(
    await tickXong(bai, null, undefined, 'fam_bu'),
    { xongSom: 0, ngayXong: DIEM_NGAY_XONG, nhiemVu: 0 },
    'khong co dong nhiem vu la nao chan -> ngay do cong duoc +10'
  );
  assert.equal(await soDu('con_bu'), truoc + DIEM_NGAY_XONG);

  // Cai gia neu KHONG co hang rao: mot dong nhiem vu 'todo' cua ngay da qua
  // (dong ma man cua con khong ve) khoa luon +10 cua ngay do.
  const baiKia = await giaoBai('fam_bu', 'con_bu', String(hom_kia), { taoNhiemVu: false });
  await db.query(
    `INSERT INTO assignments (id, child_id, subject, content, due_date, status, chore_id, stars)
     VALUES ($1, 'con_bu', 'Việc nhà', 'Tắt đèn', $2, 'todo', 'chr_bu', 1)`,
    [id('asg'), hom_kia]
  );
  const truocKia = await soDu('con_bu');
  assert.deepEqual(
    await tickXong(baiKia, null, undefined, 'fam_bu'),
    { xongSom: 0, ngayXong: 0, nhiemVu: 0 },
    'dong nhiem vu la cua ngay da qua chan +10, ma khong con duong nao tick no'
  );
  assert.equal(await soDu('con_bu'), truocKia, 'ngay do mat +10 vinh vien');
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
  // 016 doi CHECK: 'task_done' hop le, ba gia tri cu van hop le
  await db.exec(`INSERT INTO score_events (id, child_id, kind, points, event_date) VALUES ('x3', 'con_b', 'task_done', 1, '2026-09-12')`);
  await db.exec(`DELETE FROM score_events WHERE id = 'x3'`);
});

/* ---------------- Bo me tru diem (issue #43, migration 017) ---------------- */

const TEP_017 = '017_tru_diem.sql';

/**
 * Mo phong truDiem (lib/store.ts): CUNG ba cau SQL tu lib/sqlDiem.ts, trong MOT
 * transaction — khoa theo con, INSERT kep LEAST(so go, so du), doc so du sau.
 * `points` la so bo me GO (khong con duong nao khac). Tra ve { ghi, conLai } nhu
 * ket qua route.
 *
 * PGlite la mot ket noi: db.transaction() tu xep hang cac transaction dong thoi,
 * nen hai lan goi qua Promise.all chay noi tiep — ben sau doc so du DA gom lan
 * tru cua ben truoc. Tren Neon that thi hai request la hai ket noi, va
 * pg_advisory_xact_lock lam dung viec xep hang do. Ca hai truong hop deu di
 * qua cung SQL_TRU_DIEM, cau chi ghi khi so du > 0 va khong bao gio ghi qua
 * so du.
 */
async function tru(childId: string, points: number, reason = '', familyId = 'fam_cu') {
  return db.transaction(async (tx) => {
    await tx.query(SQL_KHOA_TRU_DIEM, [childId]);
    const ghi = (await tx.query(SQL_TRU_DIEM, [id('pen'), childId, points, reason, familyId])).rows;
    const [sd] = (await tx.query(SQL_SO_DU_MOT_CON, [childId, familyId])).rows as { so_du: unknown }[];
    return { ghi: ghi as Record<string, unknown>[], conLai: Number(sd?.so_du ?? 0) };
  });
}

async function soDongPhat(childId: string): Promise<number> {
  const [{ n }] = await rows(`SELECT COUNT(*) AS n FROM score_penalties WHERE child_id = $1`, [childId]);
  return Number(n);
}

/** Con moi, chua co diem, roi cong `diem` ⭐ bang mot dong task_done (khong dong vao unique cua bai). */
async function conMoiCoDiem(childId: string, diem: number, familyId = 'fam_cu') {
  await db.query(
    `INSERT INTO children (id, family_id, name, grade, color, avatar_url) VALUES ($1, $2, 'Tí', 'Lớp 1', 'primary', '/t.png')`,
    [childId, familyId]
  );
  if (diem > 0) {
    await db.query(
      `INSERT INTO score_events (id, child_id, kind, points, event_date) VALUES ($1, $2, 'task_done', $3, '2026-10-01')`,
      [id('sce'), childId, diem]
    );
  }
  assert.equal(await soDu(childId), diem);
}

test('017 chay lai duoc; score_penalties chan points <= 0 (chi tru, khong cong tay)', async () => {
  await db.exec(`DELETE FROM _migrations WHERE name = '${TEP_017}'`);
  await chayMigrations(boChay);
  const [{ n }] = await rows(`SELECT COUNT(*) AS n FROM _migrations WHERE name = '${TEP_017}'`);
  assert.equal(Number(n), 1);

  await assert.rejects(
    db.exec(`INSERT INTO score_penalties (id, child_id, points) VALUES ('p0', 'con_b', 0)`), /check/i
  );
  await assert.rejects(
    db.exec(`INSERT INTO score_penalties (id, child_id, points) VALUES ('p0', 'con_b', -2)`), /check/i
  );
});

test('tru diem: moi lan MOT dong voi DUNG so da tru + ly do + thoi diem; so du bot dung bay nhieu; tru nhieu lan mot ngay deu ghi', async () => {
  await conMoiCoDiem('con_p1', 12);

  const l1 = await tru('con_p1', 3, 'Không nghe lời');
  assert.equal(l1.ghi.length, 1);
  assert.equal(Number(l1.ghi[0].points), 3, 'luu dung so bo me go, khong luu tong sau khi tru (9)');
  assert.equal(l1.ghi[0].reason, 'Không nghe lời');
  assert.ok(l1.ghi[0].created_at, 'co thoi diem');
  assert.equal(l1.conLai, 9);
  assert.equal(await soDu('con_p1'), 9);

  // Lan hai cung ngay, khong ly do: van ghi (khong co unique index nao)
  const l2 = await tru('con_p1', 4);
  assert.equal(Number(l2.ghi[0].points), 4);
  assert.equal(l2.ghi[0].reason, '', 'ly do khong bat buoc');
  assert.equal(l2.conLai, 5);
  assert.equal(await soDu('con_p1'), 5);

  const lichSu = await rows(
    `SELECT points, reason FROM score_penalties WHERE child_id = 'con_p1' ORDER BY created_at, id`
  );
  assert.deepEqual(lichSu.map((r) => [Number(r.points), r.reason]), [[3, 'Không nghe lời'], [4, '']]);
});

test('khong cho am: go qua so con dang co -> tru DUNG so du (ve 0), khong am; het ⭐ moi tu choi', async () => {
  await conMoiCoDiem('con_p2', 5);

  // Man bo me hien 5 va nut doc "Tru het 5 ⭐", nhung so gui len van la 6 da go
  const kq = await tru('con_p2', 6, 'Cãi bố mẹ');
  assert.equal(kq.ghi.length, 1, 'khong tu choi: kep vao so du con lai');
  assert.equal(Number(kq.ghi[0].points), 5, 'luu dung so DA TRU (5), khong luu so da go (6)');
  assert.equal(kq.ghi[0].reason, 'Cãi bố mẹ');
  assert.equal(kq.conLai, 0);
  assert.equal(await soDu('con_p2'), 0, 'khong bao gio am');
  assert.equal(await soDongPhat('con_p2'), 1);

  // Ve 0 roi: day la ly do tu choi DUY NHAT
  const them = await tru('con_p2', 1);
  assert.equal(them.ghi.length, 0, 'khong con ⭐ nao de tru');
  assert.equal(them.conLai, 0);
  assert.equal(await soDongPhat('con_p2'), 1, 'khong ghi dong 0 diem nao');

  // Go dung bang so dang co thi tru het, khong kep gi
  await conMoiCoDiem('con_p2b', 5);
  const vua = await tru('con_p2b', 5);
  assert.equal(Number(vua.ghi[0].points), 5);
  assert.equal(await soDu('con_p2b'), 0);
});

test('so du TANG giua luc mo man va luc bam: go 8 khi man hien 5 ma con that su co 20 -> tru DUNG 8', async () => {
  await conMoiCoDiem('con_p3', 5);
  // Man bo me mo luc con co 5 ⭐ va nut doc "Tru het 5 ⭐"; trong luc do con lam
  // xong bai o iPad: +10 ngay xong, +1 xong som, +4 nhiem vu = 20 ⭐
  await db.query(
    `INSERT INTO score_events (id, child_id, kind, points, event_date) VALUES ($1, 'con_p3', 'task_done', 15, '2026-10-02')`,
    [id('sce')]
  );
  assert.equal(await soDu('con_p3'), 20);

  // Man hinh van dang tin la 5 nen nut doc "Tru het 5 ⭐" — nhung so NO GUI len
  // may chu la so trong o (8), khong phai mot lenh "tru sach so du".
  const nut = trangThaiTruDiem(5, '8');
  assert.equal(nut.nut, 'truHet');
  const kq = await tru('con_p3', nut.soTru!, 'Không dọn đồ');
  assert.equal(Number(kq.ghi[0].points), 8, 'tru dung so bo me go, KHONG tru sach 20 ⭐');
  assert.equal(kq.conLai, 12);
  assert.equal(await soDu('con_p3'), 12);
  assert.equal(await soDongPhat('con_p3'), 1);
});

test('hai request cung luc, moi ben go 7 khi con co 10: ben sau chi tru duoc 3; tong dung 10, khong am', async () => {
  await conMoiCoDiem('con_p4', 10);
  const [a, b] = await Promise.all([tru('con_p4', 7, 'Chơi quá giờ'), tru('con_p4', 7, 'Chơi quá giờ')]);
  assert.deepEqual(
    [Number(a.ghi[0]?.points ?? 0), Number(b.ghi[0]?.points ?? 0)].sort((x, y) => x - y),
    [3, 7],
    'ben sau bi kep vao phan con lai'
  );
  assert.equal(await soDu('con_p4'), 0, 'khong am');
  assert.equal(await soDongPhat('con_p4'), 2, 'moi lan bam la mot dong, luu dung so da tru lan do');
  const tong = await rows(`SELECT SUM(points) AS s FROM score_penalties WHERE child_id = 'con_p4'`);
  assert.equal(Number(tong[0].s), 10, 'tong da tru dung bang so da co');

  // Ve 0 roi: hai ben cung bam tiep thi ca hai bi tu choi
  const [c, d] = await Promise.all([tru('con_p4', 5), tru('con_p4', 5)]);
  assert.deepEqual([c.ghi.length, d.ghi.length], [0, 0]);
  assert.equal(await soDongPhat('con_p4'), 2);
  assert.equal(await soDu('con_p4'), 0);
});

test('tru diem KHONG dong vao ba luat cong: sau khi bi tru het, +10 / +1 / +sao van cong dung va van mot lan', async () => {
  const NGAY = '2026-10-05';
  await conMoiCoDiem('con_p5', 4);
  await tru('con_p5', 4, 'Nói dối');
  assert.equal(await soDu('con_p5'), 0);

  const bai = await themBai('con_p5', NGAY, { phut: 5 });
  const viec = await themBai('con_p5', NGAY, { chore: 'chr_1', sao: 2 });
  const T0 = Date.parse('2026-10-05T10:00:00Z');

  assert.deepEqual(await tickXong(viec, null, T0), { xongSom: 0, ngayXong: 0, nhiemVu: 2 });
  assert.deepEqual(await tickXong(bai, T0, T0 + 3 * PHUT),
    { xongSom: DIEM_XONG_SOM, ngayXong: DIEM_NGAY_XONG, nhiemVu: 0 });
  assert.equal(await soDu('con_p5'), 2 + DIEM_XONG_SOM + DIEM_NGAY_XONG, 'ba luat cong y nguyen');

  // Cong mot lan van la unique index, khong lien quan bang phat
  assert.deepEqual(await ghiDiem(bai), { xongSom: 0, ngayXong: 0, nhiemVu: 0 });
  assert.deepEqual(await ghiDiem(viec), { xongSom: 0, ngayXong: 0, nhiemVu: 0 });

  // Tru xong lai tick tiep ngay khac: van cong; hinh phat cu van nguyen trong lich su
  await tru('con_p5', 1, 'Không nghe lời');
  assert.equal(await soDu('con_p5'), 2 + DIEM_XONG_SOM + DIEM_NGAY_XONG - 1);
  assert.equal(await soDongPhat('con_p5'), 2);
  const soCong = await rows(`SELECT COUNT(*) AS n FROM score_events WHERE child_id = 'con_p5' AND points > 0`);
  assert.equal(Number(soCong[0].n), 4, 'score_events chi co dong cong: 1 mo dau + sao + som + ngay');
});

test('nha khac khong tru duoc con nha minh; xoa con keo theo hinh phat (CASCADE)', async () => {
  await db.exec(`INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ('fam_la', 'Nhà lạ', 'nha-la', 'h_tru_diem_la')`);
  await conMoiCoDiem('con_p6', 6);
  const kq = await tru('con_p6', 1, '', 'fam_la');
  assert.equal(kq.ghi.length, 0);
  assert.equal(kq.conLai, 0, 'nha la khong doc duoc ca so du');
  assert.equal(await soDu('con_p6'), 6);

  await tru('con_p6', 2);
  assert.equal(await soDongPhat('con_p6'), 1);
  await db.exec(`DELETE FROM children WHERE id = 'con_p6'`);
  assert.equal(await soDongPhat('con_p6'), 0);
});

/**
 * Mo phong nhanh DUYET cua duyetDoiThuong (lib/store.ts): CUNG bon cau SQL tu
 * lib/sqlDiem.ts trong MOT transaction — khoa theo con (cung khoa voi `tru` o
 * tren), UPDATE co kiem so du, doc trang thai, doc so du. Duyet la duong tru ⭐
 * thu hai nen hai duong phai xep hang cung cho, khong thi so du xuong duoi 0.
 *
 * `ketQua` mo phong lai dung nhanh tra ve cua store: 'ok' | 409 (dong khong con
 * 'pending' — bo/me kia vua xu ly) | 400 (con 'pending' nhung hang rao so du
 * chan). Phan biet bang TRANG THAI, khong bang so du.
 */
async function duyet(rdmId: string, childId: string, familyId = 'fam_cu') {
  return db.transaction(async (tx) => {
    await tx.query(SQL_KHOA_TRU_DIEM, [childId]);
    const daDuyet = (await tx.query(SQL_DUYET_DOI_THUONG, [rdmId, familyId])).rows;
    const [tt] = (await tx.query(SQL_TRANG_THAI_DOI_THUONG, [rdmId, familyId])).rows as
      { status?: string }[];
    const [sd] = (await tx.query(SQL_SO_DU_MOT_CON, [childId, familyId])).rows as { so_du: unknown }[];
    const conLai = Number(sd?.so_du ?? 0);
    const ketQua = daDuyet.length > 0 ? 'ok' : tt?.status !== 'pending' ? 409 : 400;
    return { daDuyet: daDuyet as Record<string, unknown>[], conLai, ketQua };
  });
}

async function xinDoi(rdmId: string, childId: string, cost: number) {
  await db.query(
    `INSERT INTO reward_redemptions (id, child_id, reward_id, reward_name, reward_icon, cost)
     VALUES ($1, $2, NULL, 'Ăn kem', '🍦', $3)`,
    [rdmId, childId, cost]
  );
}

const trangThai = async (rdmId: string): Promise<string> => {
  const [r] = await rows(`SELECT status FROM reward_redemptions WHERE id = $1`, [rdmId]);
  return String(r.status);
};

test('duyet doi thuong: du diem thi tru dung gia; thieu diem thi KHONG doi gi (con pending); nha khac khong duyet duoc', async () => {
  await conMoiCoDiem('con_p7', 10);
  await xinDoi('rdm_p7', 'con_p7', 4);

  const kq = await duyet('rdm_p7', 'con_p7');
  assert.equal(kq.ketQua, 'ok');
  assert.equal(kq.daDuyet.length, 1);
  assert.equal(kq.conLai, 6, 'so du bot dung gia phan thuong, khong ghi dong nao');
  assert.equal(await soDu('con_p7'), 6);
  assert.equal(await soDongPhat('con_p7'), 0, 'duyet khong sinh dong phat');

  // Bo me tru gan het roi moi duyet cai moi: cau UPDATE tu tu choi
  await xinDoi('rdm_p7b', 'con_p7', 5);
  await tru('con_p7', 4, 'Chưa làm bài');
  const thieu = await duyet('rdm_p7b', 'con_p7');
  assert.equal(thieu.daDuyet.length, 0, 'khong du 5 ⭐ thi khong duyet');
  assert.equal(thieu.ketQua, 400, 'van pending -> bao thieu diem, moi bo me tu choi');
  assert.equal(thieu.conLai, 2, 'so du that de bao "chi con 2 diem"');
  assert.equal(await trangThai('rdm_p7b'), 'pending', 'van cho, bo me tu choi duoc');
  assert.equal(await soDu('con_p7'), 2);

  const la = await duyet('rdm_p7b', 'con_p7', 'fam_la');
  assert.equal(la.daDuyet.length, 0, 'nha khac khong duyet duoc yeu cau cua nha nay');
  assert.equal(await trangThai('rdm_p7b'), 'pending');
});

test('bo va me cung bam Duyet: ben sau bao "da xu ly roi" (409), KHONG bao "chua du diem"', async () => {
  await conMoiCoDiem('con_p9', 10);
  await xinDoi('rdm_p9', 'con_p9', 10);

  const [x, y] = await Promise.all([duyet('rdm_p9', 'con_p9'), duyet('rdm_p9', 'con_p9')]);
  const [truoc, sau] = x.daDuyet.length === 1 ? [x, y] : [y, x];
  assert.equal(truoc.ketQua, 'ok', 'mot ben duyet duoc');
  assert.equal(
    sau.ketQua,
    409,
    'ben sau: dong da het pending. So du luc nay la 0 < 10 nen doc so du khong thoi la ' +
    'bao "chi con 0 diem, chua du 10" — moi bo me di tu choi mot thu da cho roi'
  );
  assert.ok(
    sau.conLai < 10,
    'chinh la cai bay: so du luc nay (0) nho hon gia (10), nen doc so du khong thoi ' +
    'thi ben sau se bao "chua du diem" cho mot yeu cau vua duoc duyet'
  );
  assert.equal(await trangThai('rdm_p9'), 'approved');
  assert.equal(await soDu('con_p9'), 0, 'chi tru MOT lan');

  // Bam lan thu ba (khong dong thoi) cung phai la 409
  assert.equal((await duyet('rdm_p9', 'con_p9')).ketQua, 409);
});

test('duyet va tru ⭐ cung luc: chi MOT ben tru duoc, so du KHONG xuong duoi 0', async () => {
  await conMoiCoDiem('con_p8', 10);
  await xinDoi('rdm_p8', 'con_p8', 10);

  const [d, t] = await Promise.all([duyet('rdm_p8', 'con_p8'), tru('con_p8', 10, 'Cãi bố mẹ')]);
  assert.deepEqual(
    [d.daDuyet.length, t.ghi.length].sort(),
    [0, 1],
    'dung mot trong hai duong tru di qua — ben sau thay so du da het'
  );
  assert.equal(await soDu('con_p8'), 0, 'khong bao gio am');

  const daTru = d.daDuyet.length === 1 ? 10 : Number(t.ghi[0].points);
  assert.equal(daTru, 10, 'ben nao thang thi cung tru dung 10, khong tru mot phan');
  if (d.daDuyet.length === 0) {
    assert.equal(await trangThai('rdm_p8'), 'pending', 'chua duyet duoc thi con cho, khong mat yeu cau');
  }

  // Ben chua duoc thi thu lai cung khong lot: so du da 0
  const lai = await duyet('rdm_p8', 'con_p8');
  const laiTru = await tru('con_p8', 1);
  assert.equal(lai.daDuyet.length, 0);
  assert.equal(laiTru.ghi.length, 0);
  assert.equal(await soDu('con_p8'), 0);
});

/**
 * Nut chinh cua o "tru ⭐" tren man bo me (trangThaiTruDiem trong lib/types.ts).
 * `nut` chi la MAT nut; so gui len may chu luon la `soTru` — dung so bo me go —
 * nen man hien so cu khong the tru qua so do (may chu kep LEAST, xem test tren).
 */
test('o tru ⭐: go qua so du thi nut thanh "Tru het N" chu khong khoa, va van gui dung so da go', async () => {
  assert.deepEqual(trangThaiTruDiem(5, '3'), { nut: 'tru', soTru: 3, quaSo: false, canhBao: '' });
  assert.deepEqual(trangThaiTruDiem(5, '5'), { nut: 'tru', soTru: 5, quaSo: false, canhBao: '' });

  // Go 8 khi man hien 5: moi "Tru het 5 ⭐" mot cham, KHONG phai nut khoa
  const qua = trangThaiTruDiem(5, '8');
  assert.equal(qua.nut, 'truHet', 'nut bam duoc');
  assert.equal(qua.soTru, 8, 'van gui so da go — may chu kep vao so du that, khong tru sach');
  assert.equal(qua.canhBao, 'Con chỉ có 5 ⭐', 'van noi ro con co bao nhieu');

  // Cung mat nut do khi may chu vua tra conLai = 3
  assert.equal(trangThaiTruDiem(3, '8').nut, 'truHet');
  assert.equal(trangThaiTruDiem(3, '8').canhBao, 'Con chỉ có 3 ⭐');

  // Het sao thi khong con gi de tru: nut khoa (may chu cung tu choi dung ca nay)
  const het = trangThaiTruDiem(0, '2');
  assert.equal(het.nut, null);
  assert.equal(het.canhBao, 'Con không còn ⭐ nào để trừ');

  // Chua go / go rac: nut khoa, khong canh bao gi
  for (const s of ['', '0', 'abc']) {
    assert.deepEqual(trangThaiTruDiem(5, s), { nut: null, soTru: null, quaSo: false, canhBao: '' }, s);
  }
});
