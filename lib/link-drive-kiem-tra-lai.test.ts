/**
 * Link Google Drive dan o man "Kiem tra lai" (captain 2026-09-23: "o man hinh
 * sau khi tach bai tap hay cho phep dan link film - google drive").
 *
 * Man do khong co duong luu rieng: no chi dinh link vao `media` cua ban nhap voi
 * DUNG hinh dang ma man Sua bai da dung tu #28/#60 — { url, name: 'Link Google
 * Drive', kind: 'video' } — roi POST /api/assignments -> saveSubmission ghi vao
 * assignment_media nhu moi tep khac. Bai nay ghim hai dieu de vo ma khong ai
 * thay o giao dien:
 *
 *   1. Duong luu ca dot GIU NGUYEN link (khong doi kind, khong cat query
 *      `?usp=sharing`), va moi con trong dot nhan mot dong rieng — man cua con
 *      nhan ra link Drive bang chinh URL (linkDriveTu) de ve nut "Mo Google
 *      Drive de xem" thay cho trinh phat.
 *   2. Link nay KHONG phai tep tren kho: no khong bao gio nam trong
 *      `assignments.submitted_video_url` — cot DUY NHAT ma viec don video
 *      (lib/donVideo.ts) doc — va `laUrlVideoConNop` tu choi no. Bang
 *      assignment_media chua bao gio nam trong duong xoa tep.
 *
 * Chay THAT tren PGlite trong RAM (BTVN_PGLITE_DIR=memory://), qua CHINH
 * lib/store.ts nhu lib/donVideo.test.ts.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.BTVN_PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
delete process.env.DATABASE_URL_UNPOOLED; delete process.env.POSTGRES_URL_NON_POOLING;

const { query, queryTx } = await import('./db.ts');
const { chayMigrations } = await import('../scripts/db.mjs');
const store = await import('./store.ts');
const { linkDriveTu } = await import('./media.ts');
const { laUrlVideoConNop } = await import('./donVideo.ts');

const db = {
  query: (t: string, p: unknown[] = []) => query<Record<string, unknown>>(t, p),
  chayGoi: async (cau: { sql: string; params?: unknown[] }[]) => { await queryTx(cau); },
};

const NHA = 'fam_link_drive';
const CON = ['con_ld_minh', 'con_ld_an'];
const LINK = 'https://drive.google.com/file/d/1NnPqgO9iYBtIcO3WDnESJfl7MU1nKtfZ/view?usp=sharing';

before(async () => {
  await chayMigrations(db);
  await query(
    `INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ($1, $1, $1, 'h-ld')`, [NHA]
  );
  for (const c of CON) {
    await query(
      `INSERT INTO children (id, family_id, name, avatar_url, color) VALUES ($1, $2, $1, '', 'primary')`,
      [c, NHA]
    );
  }
});

test('luu ca dot tu man Kiem tra lai: link Drive vao assignment_media cua TUNG con, nguyen van', async () => {
  const created = await store.saveSubmission({
    familyId: NHA,
    rawText: 'Xem 2-3 tập phim',
    imageUrls: [],
    childIds: CON,
    dueDate: '2026-09-22',
    source: 'english_class',
    drafts: [{
      subject: 'Khác', icon: '📚', content: 'Xem 2-3 tập phim', note: null, lang: 'vi', confidence: 1,
      // Dung hinh dang man Kiem tra lai (themLinkDrive) va man Sua bai (addDriveLink) gui len
      media: [{ url: LINK, name: 'Link Google Drive', kind: 'video' }],
      durationMinutes: 15, requiresVideo: false,
    }],
  });

  assert.equal(created.length, 2, 'moi con mot bai');
  for (const a of created) {
    assert.deepEqual(a.media, [{ url: LINK, name: 'Link Google Drive', kind: 'video' }]);
    assert.equal(linkDriveTu(a.media[0].url), LINK, 'man cua con nhan ra link Drive bang chinh URL');
    assert.equal(a.submittedVideoUrl, null, 'link dinh kem khong lot vao cot video con nop');
  }

  // Doc lai tu CSDL, khong tin ket qua tra ve cua ham
  const dong = await query<{ assignment_id: string; url: string; kind: string }>(
    `SELECT m.assignment_id, m.url, m.kind FROM assignment_media m
       JOIN assignments a ON a.id = m.assignment_id
      WHERE a.child_id = ANY($1) ORDER BY a.child_id`,
    [CON]
  );
  assert.equal(dong.length, 2);
  assert.ok(dong.every((d) => d.url === LINK && d.kind === 'video'));
});

test('link Drive khong phai tep tren kho: viec don video khong bao gio nhin thay hay xoa no', async () => {
  // Cot duy nhat ma lib/donVideo.ts doc de chon tep xoa
  const nop = await query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM assignments a JOIN children c ON c.id = a.child_id
      WHERE c.family_id = $1 AND a.submitted_video_url IS NOT NULL`, [NHA]
  );
  assert.equal(Number(nop[0].n), 0);
  // Va ke ca khi mot URL Drive lot vao duong do, hang rao 3 van tu choi
  assert.equal(laUrlVideoConNop(LINK), false);
});
