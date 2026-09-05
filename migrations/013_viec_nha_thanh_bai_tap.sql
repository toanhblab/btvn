-- Nhiem vu mac dinh ("viec nha") tro thanh MOT DONG THAT trong assignments,
-- thay vi chi song rieng o daily_chores/daily_chore_checks va chi hien o man
-- /xong sau khi lam het bai (issue #25, #30). Issue #36: viec nha duoc TAO
-- CUNG LUC voi bai tap cho mot ngay cu the (luc saveSubmission chay trong
-- lib/store.ts), xep cuoi cung trong danh sach nhiem vu hom nay o man cua con.
--
-- Tai dung bang assignments thay vi tach bang rieng: cot chore_id (nullable)
-- la DAU HIEU DUY NHAT phan biet mot dong la viec nha hay bai tap that. Co y
-- KHONG them 'viec-nha' vao HW_SOURCES (lib/types.ts) — hang so do bi
-- Object.keys() lap lai o 4 man nhap/sua bai cua bo me (ThemBaiTap, NhapTay,
-- KiemTraLai, SuaBai) de ve nut "chon noi giao"; them mot gia tri vao do se
-- hien mot nut co the bam nham cho mot bai THAT.
--
-- ON DELETE SET NULL, khong CASCADE: dung tien le da co san cua chinh bang nay
-- (assignments.submission_id REFERENCES submissions(id) ON DELETE SET NULL,
-- xem migrations/001_khoi_tao.sql va ly do o migrations/011_nguon_khac.sql) —
-- xoa cai sinh ra mot dong khong duoc phep keo theo xoa dong do. Bo me xoa han
-- mot viec nha (khong phai tat) thi cac dong lich su da tao chi mat dau hieu
-- "day la viec nha" (chore_id ve NULL), khong mat noi dung — content da duoc
-- copy nguyen van luc tao dong (xem lib/store.ts).
--
-- Unique index chan tao trung: nhieu dot nop bai (khac nguon giao bai) cung
-- roi vao mot (con, ngay) khong duoc sinh hai bo viec nha cho ngay do.
-- saveSubmission dung ON CONFLICT tren index nay khi INSERT thay vi chi tin
-- vao buoc SELECT-kiem-tra-truoc, vi hai request nop bai dong thoi se cung
-- luot qua buoc SELECT do truoc khi ben nao kip ghi.

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS chore_id TEXT REFERENCES daily_chores(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_chore_once_idx
  ON assignments (child_id, due_date, chore_id)
  WHERE chore_id IS NOT NULL;
