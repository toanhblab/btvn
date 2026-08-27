-- Thoi luong lam bai (phut) — dong ho dem nguoc o man cua con chay tu so nay.
--
-- AI uoc luong theo do phuc tap va bi kep trong 5-15 phut (lib/ai.ts); bo me
-- sua tay thi duoc ghi gia tri ngoai khoang do. Mac dinh 10 de moi bai cu
-- (giao truoc khi co cot nay) van hien dong ho binh thuong.
--
-- So 006 da danh cho thay doi thu-tu-bai dang lam do ngoai repo — bo chay
-- migration di theo ten tep chua chay nen khoang trong so thu tu khong sao.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 10 CHECK (duration_minutes > 0);
