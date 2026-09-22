-- Sach / vo / nguon bai tap cua cac con (issue #64), de AI tach bai theo CUON SACH.
--
-- Captain: "lam bai tap toan trang 41, 42, 43 o sach Poth Math" dang bi tach thanh
-- ba bai; nguyen tac phai la MOT CUON SACH = MOT BAI, khong phai mot dong = mot
-- bai. Va bo me can mot cho khai bao sach cua cac con de AI nhan dung ten sach
-- (viet tat, viet sai chinh ta) va doan dung mon.
--
-- Hai quyet dinh ve luoc do, va ly do:
--
-- 1. Sach treo vao NHA (family_id) kem `child_ids` giong daily_chores (016):
--    NULL = ca nha, mang = chi nhung con do. Captain viet "sach cua CAC CON" —
--    nghieng ve tung con — nhung hai be sinh doi hoc cung lop dung CHUNG sach
--    (truong hop dung nhieu nhat, PRD 4.1): treo vao tung con la bo me phai khai
--    mot cuon hai lan, va sua ten mot lan thi lech nhau. Mang `child_ids` cho ca
--    hai kieu: sach chung ca nha, va sach rieng cua be mau giao. Khi bo me giao
--    bai cho mot nhom con, AI chi duoc dua danh sach sach cua DUNG nhom do
--    (listBooks(familyId, { childIds }) trong lib/store.ts).
--
--    Xoa mot con thi `deleteChild` GO id do ra khoi mang (array_remove) — cung
--    bat bien voi daily_chores.child_ids: cau hinh khong bao gio tro toi mot con
--    khong con ton tai, khong thi hang "Giao cho" cua sach do khong sua duoc nua.
--
-- 2. Bo mot cuon sach la DANH DAU DA BO (archived_at), khong DELETE — luat cua du
--    an tu migrations/014. O day khong co khoa ngoai nao tro vao books (ten sach
--    duoc AI ghi THANG vao assignments.note luc tach bai, khong luu book_id), nen
--    ve du lieu thi DELETE cung khong lam bai cu mat nguon. Van chon danh dau bo
--    vi: (a) danh sach sach cua nha la mot phan lich su hoc cua con, nam hoc sau
--    co the can lai; (b) mot cuon da bo van co the xuat hien trong tin nhan cu cua
--    co — giu dong lai thi sau nay muon cho AI nhan ca sach cu chi la doi mot bo
--    loc. listBooks/getBook (lib/store.ts) loai dong da bo o MOI duong doc, ke ca
--    duong dua vao loi nhac AI.
--
-- `subject` la KHOA phan loai (ten mon tieng Viet trong SUBJECTS, lib/types.ts),
-- khong phai chu hien len man — man nao hien thi boc T(subject); NULL = bo me
-- chua chon / sach nhieu mon. Khong CHECK (cung tien le HW_SOURCES: bo mon them
-- sau khong can migration), ma loc trong code (`monSachOf`).
--
-- Khong co cot nao dung enum / ALTER TYPE: scripts/db.mjs chay MOI cau cua mot
-- migration trong MOT transaction, ma `ALTER TYPE ... ADD VALUE` khong dung duoc
-- trong transaction tren Postgres that (55P04) du PGlite cho qua.

CREATE TABLE IF NOT EXISTS books (
  id          TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  subject     TEXT,
  child_ids   TEXT[],
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS books_family_idx ON books (family_id, created_at);
