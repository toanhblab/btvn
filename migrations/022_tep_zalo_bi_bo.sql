-- Tep cua mot tin Zalo KHONG giu duoc, kem ly do (review vong 1 cua PR "bài từ Zalo").
--
-- Truoc do mot tep sai loai (.docx co gui kem) hay qua 25MB lam CA GOI tra 400:
-- tin cua co khong bao gio vao app, ma zalo-agent gui lai moi 30 phut nen no
-- hong vinh vien — khong ban nhap, khong muc "chờ duyệt", khong ai biet vi sao.
-- Gio tep do bi BO RIENG, tin van vao; nhung "bo im lang" cung khong duoc: bo me
-- nhin muc cho duyet phai thay co mot tep cua co khong vao duoc, khong thi ho
-- doi chieu nguyen van tin voi mot bo tep thieu ma tuong app da nhan du.
--
-- Mot cot RIENG chu khong nhet them vao `dinh_kem`: `dinh_kem` la danh sach tep
-- DA LUU (moi phan tu co `url` va `han_xoa`, man duyet dung de ve trinh phat),
-- con day la danh sach tep KHONG co url. Tron hai cai vao mot mang la moi noi
-- doc `dinh_kem` phai loc truoc khi ve.
--
-- Hai cho sinh ra no, mot danh sach: luc doc goi (lib/zalo.ts — sai loai, qua
-- nang, base64 hong) va luc tai len kho (lib/nhanBaiZalo.ts — chua bat Vercel
-- Blob tren may chu, `put` nem). Dang: [{ ten, ly_do, chi_tiet? }].
ALTER TABLE bai_tu_zalo
  ADD COLUMN IF NOT EXISTS tep_bo_qua JSONB NOT NULL DEFAULT '[]'::jsonb;
