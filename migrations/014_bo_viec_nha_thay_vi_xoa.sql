-- Bo me "xoa" mot viec nha o man Cai dat tu nay chi la DANH DAU DA BO, khong
-- xoa dong that nua (deleteChore trong lib/store.ts doi tu DELETE sang UPDATE).
--
-- Vi sao: migrations/013 cho assignments.chore_id ON DELETE SET NULL, nen xoa
-- that mot dong daily_chores se lam MOI dong lich su sinh tu no mat dau hieu
-- "day la viec nha" — chore_id ve NULL thi chung tro thanh BAI TAP THAT: lot
-- qua bo loc mac dinh cua listAssignments, dem vao badge "Qua han" o man tong
-- quan cua bo me, va hien thanh the bai tap binh thuong dan sang /bai/[id] voi
-- doc to de bai + dong ho dem nguoc cho mot cau nhu "Tat den hoc". Chore_id la
-- dau hieu DUY NHAT (013), nen phai giu no lai.
--
-- Giu nguyen ON DELETE SET NULL o 013 (khong sua migration da chay): tu nay
-- khong con duong nao cua bo me DELETE that mot dong daily_chores nua, ve do
-- chi con la hang rao an toan cua schema.
--
-- "Da bo" (archived_at) KHAC "tat" (enabled = false):
--   - tat   : van hien o man Cai dat, bat lai duoc, chi ngung tao dong moi.
--   - da bo : an han khoi man Cai dat, khong co nut khoi phuc, cung ngung tao
--             dong moi. listChores/getChore (lib/store.ts) loai het cac dong nay
--             o MOI loi goi — ke ca luoc listChores(enabledOnly) ma saveSubmission
--             dung de tao dong viec nha cho mot ngay moi.
--
-- Cac dong assignments cu cua mot viec da bo GIU NGUYEN chore_id nen van duoc
-- nhan dien dung la viec nha o moi noi, giu nguyen ca lich su da tick.

ALTER TABLE daily_chores
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
