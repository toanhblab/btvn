/**
 * Cau SQL tao dong nhiem vu hang ngay cua MOT ngay — MOT ban duy nhat cho ca ba
 * ben dung no: `taoNhiemVuNgay` (lib/store.ts), `scripts/seed.mjs`, va ba tep
 * test PGlite (lib/nhiem-vu-hang-ngay.test.ts,
 * lib/nhiem-vu-mac-dinh-hoan-thanh.test.ts, lib/tinh-diem.test.ts).
 *
 * Vi sao tach ra day: cac tep test la thu DUY NHAT kiem cau nay, ma khong tep
 * nao nap duoc lib/store.ts (store import khong duoi — `from './db'` — nen
 * `node --test` khong resolve duoc). Truoc day moi ben giu mot ban sao 13 dong:
 * sua ban trong store ma quen bon ban kia thi test van XANH trong khi san pham
 * da doi hanh vi. Tep nay KHONG import gi luc chay nen ca Next lan `node --test`
 * lan `node scripts/seed.mjs` deu nap duoc (cung khuon voi lib/nhomNhiemVu.ts).
 *
 * Y nghia cau: MOT `INSERT ... SELECT ... ON CONFLICT DO NOTHING` tren unique
 * index (child_id, due_date, chore_id) cua migrations/013 — goi bao nhieu lan
 * cung chi tao moi dong mot lan, hai request cung luc khong tao trung, khong can
 * buoc SELECT-kiem-truoc. id sinh trong SQL (md5 ngau nhien, tien to 'asg_' +
 * 16 hex de cung hinh dang voi newId('asg')) vi so dong chi biet sau khi SELECT.
 * CHEP icon/content/stars tu `daily_chores` vao dong (nhom thi doc live — xem
 * ASSIGNMENT_SELECT).
 *
 * THU TU THAM SO — dung sai la ghi sai du lieu, khong ai bao:
 *   $1 familyId          id nha
 *   $2 date              ngay cua dong, YYYY-MM-DD
 *   $3 subject           VIEC_NHA_SUBJECT (lib/store.ts) — 'Việc nhà'
 *   $4 source            HW_SOURCE_DEFAULT (lib/types.ts) — cot NOT NULL
 *   $5 durationMinutes   DURATION_DEFAULT (lib/types.ts) — cot NOT NULL
 *   $6 childIds          null = moi con trong nha; hoac chi cac con nay
 *
 * Ba tham so $3..$5 la HANG SO cua app: seed va test truyen chuoi/so nguyen
 * thang (khong import duoc lib/store.ts), nen doi hang so o types.ts/store.ts
 * thi phai doi ca ben do — chi con ba gia tri ngan phai canh nhau, khong con ca
 * cau SQL.
 */
export const SQL_TAO_NHIEM_VU_NGAY = `INSERT INTO assignments
     (id, child_id, subject, icon, content, lang, due_date, source, duration_minutes,
      requires_video, chore_id, stars)
   SELECT 'asg_' || substr(md5(random()::text || c.id || dc.id || $2::text), 1, 16),
          c.id, $3, dc.icon, dc.content, 'vi', $2::date, $4, $5, false, dc.id, dc.stars
     FROM daily_chores dc
     JOIN children c ON c.family_id = dc.family_id
    WHERE dc.family_id = $1 AND dc.enabled AND dc.archived_at IS NULL
      AND (dc.child_ids IS NULL OR c.id = ANY(dc.child_ids))
      AND ($6::text[] IS NULL OR c.id = ANY($6::text[]))
   ON CONFLICT (child_id, due_date, chore_id) WHERE chore_id IS NOT NULL DO NOTHING`;
