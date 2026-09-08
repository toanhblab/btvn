-- Bo me TRU diem con khi con chua nghe loi (issue #43). Captain chot nam dieu:
--
--   1. Bo me GO SO DIEM MUON TRU (khong go "tong moi" de may tu tinh hieu).
--      He qua: moi dong duoi day luu DUNG so da tru mot lan — mot delta duong —
--      khong bao gio luu tong sau khi tru.
--   2. KHONG CHO SO DU AM. Go qua so con dang co thi may chu TU CHOI va man bo
--      me moi bam "Tru het N" — N tinh lai TAI LUC BAM tren may chu, khong dung
--      so cu da hien (con co the vua kiem them sao).
--   3. Ly do: CO, KHONG bat buoc, kem vai nut goi y mot cham.
--   4. CON NHIN THAY minh bi tru va vi sao: cua hang cua con hien tung dong tru
--      kem ly do. Vi the ly do la thu CON DOC — nut goi y viet bang loi noi
--      duoc voi con.
--   5. KHONG cho bo me CONG tay. Chi tru — CHECK (points > 0).
--
-- MOT BANG PHAT RIENG, khong ghi dong am vao score_events, khong gia dang mot
-- lan doi thuong. Vi trong luoc do 015, DAU (cong/tru) la thuoc tinh cua BANG,
-- khong phai cua DONG: score_events chi chua so duong va la "so cong",
-- reward_redemptions chi chua so duong va la "so tru" (khi approved). Hinh phat
-- la loai "tru" thu hai nen la bang thu ba. Nho vay:
--   - Moi cau da viet o 015/016 ("chi ghi diem CONG", "points > 0", ba unique
--     index partial la luat cong mot lan) van dung nguyen — khong noi long gi.
--   - Khong lan voi doi thuong: reward_id IS NULL o reward_redemptions da co
--     nghia "phan thuong bi xoa" (ON DELETE SET NULL), khong the dung lam co
--     "day la hinh phat"; nhan "✅ Bo me dong y" o man con cung se sai.
--   - So du = SUM(score_events) - SUM(reward_redemptions approved)
--             - SUM(score_penalties)   — them dung MOT so hang, xem lib/sqlDiem.ts.
--
-- Nam cot, het:
--   points   so bi tru, DUONG nhu `cost` — dung so bo me go (hoac so du luc bam
--            "Tru het"). Khong co cot "tong sau khi tru": voi cach (1) no khong
--            can cho nghia cua dong ("−3" tu doc duoc), va them cot chi de
--            phong xa la trai luat dung cua captain.
--   reason   NOT NULL DEFAULT '' — de trong duoc (dieu 3). Man cua con thay
--            trong thi hien cau LY_DO_TRU_TRONG (lib/types.ts), khong de trong hoac.
--   KHONG co event_date / assignment_id / status / family_id:
--     - Khong event_date: hinh phat la hanh dong cua bo me LUC NAY, khong co
--       "ngay cua bai" de ap families.score_since (khong hoi to) len no. Khong
--       de cot do vao de khong ai sau nay "tien tay" ap ngayDuocTinhDiem.
--     - Khong assignment_id: phat vi "khong nghe loi", khong vi mot bai. Doi
--       xung voi tien le 015 "xoa bai khong lam mat diem da kiem": xoa bai cung
--       khong hoi diem da tru.
--     - Khong status: bo me ghi la co hieu luc ngay (khac doi thuong co buoc
--       con xin), khong co hai pha de lech.
--     - Khong family_id: thuoc nha nao la qua child_id -> children.family_id,
--       nhu score_events / reward_redemptions / assignments.
--   Xoa CON thi hinh phat di theo (CASCADE) — hinh phat khong co con la vo nghia.
--   KHONG co unique index: mot ngay tru nhieu lan la binh thuong, moi lan mot dong.
--
-- "Khong am" chan o DAU? KHONG kep bang GREATEST(0, …) trong SUM — so du se khong
-- con bang so sach, thanh hai su that. Chan LUC GHI, hai tang:
--   - Giao dien: nut "Tru N" khoa khi N > so dang hien, va khi may chu tu choi
--     thi hien "Con chi con N ⭐" + nut "Tru het N".
--   - Du lieu: mot INSERT … SELECT chi ghi khi so du (tinh tai cho, cung cong
--     thuc voi soDiemTheoCon) >= so tru; chay TRONG MOT TRANSACTION sau
--     pg_advisory_xact_lock(hashtext(child_id)) de hai request cung luc (hai bo
--     me cung bam, hay "tru het" tren hai may) khong cung doc mot so du roi cung
--     ghi. lib/db.ts truoc day chay moi cau mot request khong transaction;
--     queryTx (them o day) goi ca goi trong mot transaction — Neon HTTP co
--     sql.transaction() khong tuong tac, PGlite co db.transaction(). Xem
--     SQL_TRU_DIEM trong lib/sqlDiem.ts va test lib/tinh-diem.test.ts.
--
-- Chay lai nhieu lan duoc (IF NOT EXISTS). Khong dong vao bang nao co san.

CREATE TABLE IF NOT EXISTS score_penalties (
  id         TEXT PRIMARY KEY,
  child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  points     INTEGER NOT NULL CHECK (points > 0),
  reason     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS score_penalties_child_idx
  ON score_penalties (child_id, created_at);
