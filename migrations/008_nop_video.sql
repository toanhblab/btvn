-- Nop bai bang VIDEO: co giao hay giao bai kieu "doc to bai tho", "doc thuoc
-- long", "quay video gui co" — nhung bai nay tick suong la khong du, phai co
-- video con lam that thi bo me moi kiem tra duoc.
--
--   requires_video      bai nay co bat buoc quay video khong. AI danh dau luc
--                       tach bai, bo me bat/tat lai duoc o man /bome.
--   submitted_video_url video con da quay va nop. Moi bai giu MOT video moi
--                       nhat — con quay lai thi thay URL, khong giu lich su.
--   submitted_video_at  luc con nop, de bo me biet con lam khi nao.
--
-- So 006 va 007 da co nguoi dung o nhanh khac (teacher-order, timer) nen nhay
-- len 008 — bo chay migration di theo ten tep, khuyet so khong sao.

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS requires_video BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS submitted_video_url TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS submitted_video_at TIMESTAMPTZ;
