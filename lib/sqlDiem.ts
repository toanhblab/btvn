/**
 * Cau SQL ve SO DU ⭐ cua con va ve TRU DIEM (issue #43) — MOT ban duy nhat cho
 * `lib/store.ts` va test PGlite `lib/tinh-diem.test.ts`. Tep nay KHONG import gi
 * luc chay nen ca Next lan `node --test` deu nap duoc (cung khuon voi
 * lib/sqlNhiemVu.ts — doc chu thich o do ve vi sao test khong nap duoc store).
 *
 * SO DU cua con `c` (bang children dang duoc alias la `c`):
 *     tong score_events (chi diem CONG, migrations/015+016)
 *   - tong reward_redemptions da duyet   ("so tru" thu nhat, 015)
 *   - tong score_penalties               ("so tru" thu hai — bo me tru, 017)
 * Dau la thuoc tinh cua BANG, dong nao cung la so duong; khong co dong diem am
 * (AGENTS.md). Them mot loai tru nua la them mot so hang o day, KHONG kep
 * GREATEST(0, …): so du phai luon bang so sach.
 */
export const SQL_SO_DU_CON = `(
            COALESCE((SELECT SUM(e.points) FROM score_events e WHERE e.child_id = c.id), 0)
          - COALESCE((SELECT SUM(r.cost) FROM reward_redemptions r
                       WHERE r.child_id = c.id AND r.status = 'approved'), 0)
          - COALESCE((SELECT SUM(p.points) FROM score_penalties p WHERE p.child_id = c.id), 0)
          )`;

/**
 * Khoa theo con truoc khi tru — cau DAU TIEN cua transaction tru diem. Hai
 * transaction cung con xep hang o day; cau INSERT ben duoi chay SAU khi lay
 * duoc khoa nen doc so du DA GOM lan tru cua ben truoc (READ COMMITTED: moi cau
 * trong transaction lay snapshot moi). Chi khoa trong transaction (xact) — het
 * transaction la tha, khong can UNLOCK.
 *   $1 childId
 */
export const SQL_KHOA_TRU_DIEM = `SELECT pg_advisory_xact_lock(hashtext($1::text))`;

/**
 * Ghi MOT dong phat, CHI KHI so du (tinh tai cho, cung cong thuc SQL_SO_DU_CON)
 * du de tru — day la tang du lieu cua luat "khong am". Ghi duoc thi RETURNING
 * dong vua ghi; khong du thi 0 dong, khong ghi gi. So du sau do doc bang
 * SQL_SO_DU_MOT_CON ngay trong cung transaction.
 *
 *   $1 id          newId('pen')
 *   $2 childId
 *   $3 points      so bo me go (nguyen duong), HOAC NULL = "Tru het": tru dung
 *                  so du tai luc cau nay chay (captain: N tinh tai thoi diem bam,
 *                  khong dung so cu da hien). Tru het khi so du = 0 thi khong
 *                  ghi (COALESCE($3, 1): can it nhat 1 ⭐).
 *   $4 reason      chu bo me go, da trim/cat; '' = khong ghi ly do
 *   $5 familyId    con phai thuoc nha nay — bang khong co family_id
 */
export const SQL_TRU_DIEM = `INSERT INTO score_penalties (id, child_id, points, reason)
   SELECT $1, c.id, COALESCE($3::int, b.so_du), $4
     FROM children c
     CROSS JOIN LATERAL (SELECT ${SQL_SO_DU_CON} AS so_du) b
    WHERE c.id = $2 AND c.family_id = $5
      AND b.so_du >= COALESCE($3::int, 1)
   RETURNING id, child_id, points, reason, created_at`;

/**
 * So du hien tai cua MOT con — cau CUOI cua transaction tru diem, de tra ve
 * "con lai" (ghi duoc) hoac "con chi con N" (bi tu choi) ma khong can vong goi
 * thu hai. Cung dung duoc rieng.
 *   $1 childId   $2 familyId
 */
export const SQL_SO_DU_MOT_CON = `SELECT ${SQL_SO_DU_CON} AS so_du
     FROM children c WHERE c.id = $1 AND c.family_id = $2`;
