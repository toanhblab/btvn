-- Nhiem vu moi ngay ("viec nha"): sau khi lam xong bai tap cuoi cung cua hom nay,
-- con duoc nhac cat sach vo, tat den hoc, soan sach cho ngay mai — va tick tung
-- viec. Bo me cai dat danh sach nay o man Cai dat.
--
-- MOT danh sach CHUNG CA NHA, khong phai moi con mot danh sach: bo me sua mot lan
-- ap cho moi con. Nen daily_chores treo vao families chu khong vao children.
--
-- Danh dau da lam thi lai theo TUNG CON va TUNG NGAY (daily_chore_checks): bo me
-- phai xem duoc "hom nay Minh da cat sach chua". Khoa duy nhat tren
-- (con, viec, ngay) de tick hai lan khong sinh hai dong — con bam nhieu lan la
-- chuyen binh thuong.
--
-- Khong co cot family_id trong daily_chore_checks: no thuoc nha nao la qua
-- child_id -> children.family_id, giong cach assignments dang lam. Khong nhan doi
-- de khong bao gio co chuyen hai cho ghi lech nhau.

CREATE TABLE IF NOT EXISTS daily_chores (
  id         TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Bo me tat mot viec thay vi xoa: tat roi bat lai thi khong mat lich su tick.
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_chores_family_idx ON daily_chores (family_id, sort_order);

CREATE TABLE IF NOT EXISTS daily_chore_checks (
  id         TEXT PRIMARY KEY,
  child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  chore_id   TEXT NOT NULL REFERENCES daily_chores(id) ON DELETE CASCADE,
  done_date  DATE NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_chore_checks_uniq
  ON daily_chore_checks (child_id, chore_id, done_date);

CREATE INDEX IF NOT EXISTS daily_chore_checks_child_date_idx
  ON daily_chore_checks (child_id, done_date);

-- Ba viec mac dinh cho MOI nha dang co. Nha tao moi sau nay duoc nap ba viec nay
-- o insertFamily (lib/store.ts) va scripts/seed.mjs — ba noi phai cung mot danh
-- sach, doi mot cho la phai doi ca ba.
--
-- Chay lai duoc nhieu lan: id sinh tu md5(family_id + so thu tu) nen khong doi
-- giua hai lan chay, va menh de WHERE bo qua nha da co san viec — nha nao bo me
-- da tu sua danh sach thi migration khong dong vao.
INSERT INTO daily_chores (id, family_id, content, sort_order)
SELECT 'chr_' || substr(md5(f.id || ':' || v.n::text), 1, 16), f.id, v.content, v.n
  FROM families f
 CROSS JOIN (VALUES
   (1, 'Cất sách vở vào ba lô'),
   (2, 'Tắt đèn học'),
   (3, 'Soạn sách vở cho ngày mai')
 ) AS v(n, content)
 WHERE NOT EXISTS (SELECT 1 FROM daily_chores d WHERE d.family_id = f.id)
ON CONFLICT (id) DO NOTHING;
