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
 * Ghi MOT dong phat — MOT duong duy nhat cho moi lan bo me bam, va la tang du
 * lieu cua luat "khong am".
 *
 * `$3` la con so tren NHAN cua nut bo me vua bam (xem trangThaiTruDiem trong
 * lib/types.ts: nhan "Trừ hết 5 ⭐" gui 5, nhan "Trừ 3 ⭐ của …" gui 3). So thuc
 * su tru la `LEAST($3, so du tai luc cau nay chay)`, nen:
 *   - nhan ghi 8 ma con that su chi co 5 -> tru 5 (ve 0, khong am);
 *   - nhan ghi 5 ma con vua kiem them thanh 20 -> tru DUNG 5. Cau nay khong bao
 *     gio tru qua so nhan duoc, va man hinh khong bao gio gui so khac so tren nhan.
 * Tu choi CHI khi so du = 0 (`b.so_du > 0`): khong con gi de tru thi 0 dong,
 * khong ghi dong 0 diem (CHECK cua bang chan). So du sau do doc bang
 * SQL_SO_DU_MOT_CON ngay trong cung transaction.
 *
 *   $1 id          newId('pen')
 *   $2 childId
 *   $3 points      so tren nhan nut (nguyen duong) — tran tren cua lan tru nay
 *   $4 reason      chu bo me go, da trim/cat; '' = khong ghi ly do
 *   $5 familyId    con phai thuoc nha nay — bang khong co family_id
 */
export const SQL_TRU_DIEM = `INSERT INTO score_penalties (id, child_id, points, reason)
   SELECT $1, c.id, LEAST($3::int, b.so_du), $4
     FROM children c
     CROSS JOIN LATERAL (SELECT ${SQL_SO_DU_CON} AS so_du) b
    WHERE c.id = $2 AND c.family_id = $5
      AND b.so_du > 0
   RETURNING id, child_id, points, reason, created_at`;

/**
 * So du hien tai cua MOT con — cau CUOI cua transaction tru diem, de tra ve
 * "con lai" cho man bo me (ke ca khi bi tu choi) ma khong can vong goi thu hai.
 * Cung dung duoc rieng.
 *   $1 childId   $2 familyId
 */
export const SQL_SO_DU_MOT_CON = `SELECT ${SQL_SO_DU_CON} AS so_du
     FROM children c WHERE c.id = $1 AND c.family_id = $2`;

/**
 * Duyet mot yeu cau doi thuong — cau THU HAI cua transaction duyet, chay SAU
 * SQL_KHOA_TRU_DIEM cua con do.
 *
 * Duyet la duong TRU ⭐ thu hai (so du bot vi dong nay thanh 'approved', khong
 * ghi dong nao ca), nen phai xep hang o CUNG mot khoa voi SQL_TRU_DIEM: doc "du
 * diem" o mot request roi UPDATE trong khi request kia vua tru het la cach day
 * so du xuong duoi 0.
 *
 * Dieu kien so du >= r.cost tinh TAI CHO (dong nay con 'pending' nen chua nam
 * trong SQL_SO_DU_CON) — day la tang du lieu cua luat "khong am" cho duong duyet,
 * cung khuon voi SQL_TRU_DIEM. Duyet duoc thi RETURNING dong vua doi; khong du
 * diem (hoac dong da bi xu ly) thi 0 dong, khong doi gi.
 *   $1 id (reward_redemptions)   $2 familyId
 */
export const SQL_DUYET_DOI_THUONG = `UPDATE reward_redemptions r
      SET status = 'approved', decided_at = now()
    WHERE r.id = $1 AND r.status = 'pending'
      AND EXISTS (SELECT 1 FROM children c
                   WHERE c.id = r.child_id AND c.family_id = $2
                     AND ${SQL_SO_DU_CON} >= r.cost)
   RETURNING r.*`;

/**
 * Trang thai cua yeu cau doi thuong — cau THU BA cua transaction duyet, de doc
 * VI SAO SQL_DUYET_DOI_THUONG khong doi dong nao.
 *
 * So du KHONG phan biet duoc hai ly do: bo/me kia vua duyet xong thi gia da bi
 * tru, nen so du con lai gan nhu luon nho hon gia — doc so du khong thoi la bao
 * "chua du diem" (moi bo me tu choi) cho mot yeu cau DA DUOC DUYET. Trang thai
 * moi phan biet duoc: khong con 'pending' = da xu ly (409); van 'pending' = cau
 * UPDATE bi hang rao so du chan (400).
 *   $1 id (reward_redemptions)   $2 familyId
 */
export const SQL_TRANG_THAI_DOI_THUONG = `SELECT r.status
     FROM reward_redemptions r
     JOIN children c ON c.id = r.child_id
    WHERE r.id = $1 AND c.family_id = $2`;

/**
 * VI SAO SQL_DUYET_DOI_THUONG khong doi dong nao — nhanh tra ve cua
 * `duyetDoiThuong` (lib/store.ts), tach ra thanh ham thuan de test PGlite
 * (lib/tinh-diem.test.ts) khang dinh dung nhanh nay chu khong tu suy lai mot ban
 * thu hai roi de hai ban lech nhau.
 *
 * THU TU la ca noi dung cua ham: TRANG THAI xet TRUOC so du. Xet so du truoc thi
 * bo/me kia vua duyet xong -> gia da bi tru -> so du con lai gan nhu luon nho hon
 * gia, va ben sau doc phai "chua du diem" cho mot yeu cau DA DUOC DUYET (moi bo
 * me di tu choi mot thu da cho roi).
 *
 *   soDongDoi   so dong SQL_DUYET_DOI_THUONG doi duoc (0 hoac 1)
 *   trangThai   status doc lai bang SQL_TRANG_THAI_DOI_THUONG (undefined = khong
 *               con dong nao / khong thuoc nha nay)
 */
export type NhanhDuyet = 'duyetDuoc' | 'daXuLy' | 'thieuDiem';

export function nhanhDuyet(soDongDoi: number, trangThai: string | undefined): NhanhDuyet {
  if (soDongDoi > 0) return 'duyetDuoc';
  return trangThai !== 'pending' ? 'daXuLy' : 'thieuDiem';
}
