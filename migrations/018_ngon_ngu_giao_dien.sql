-- Ngon ngu GIAO DIEN cua tung nha (issue #46): chu cua app (nut, tieu de, thong
-- bao) hien theo ngon ngu cua nha dang mo, khong theo may. May nhap PIN nha nao
-- thi thay chu cua nha do.
--
-- Mac dinh 'vi' cho MOI nha dang co: nha that cua captain len ban moi khong doi
-- gi. Ba nha demo (PIN 1111 = 'ja', 2222 = 'ko', 3333 = 'en') do
-- scripts/seed-demo.mjs tao, khong phai migration nay.
--
-- CANH BAO — dung nham voi assignments.lang: cot do PHAN LOAI DE BAI (bai tieng
-- Anh cua lop hoc them doc bang giong en-US, xem migrations/001, 010, 011), KHONG
-- phai ngon ngu giao dien, va khong duoc dung lai cho viec nay. Vi vay cot moi
-- dat ten khac han (ui_locale) va nam o families, khong o assignments.
--
-- Chu bo me tu go (de bai, ten nhiem vu, ten phan thuong) KHONG dich luc chay —
-- chi doi chu cua app. Bo gia tri hop le nam o lib/i18n/ngonNgu.ts; them ngon
-- ngu thi DROP roi ADD lai CHECK nay voi DU danh sach (cung tien le voi
-- score_events_kind_check o migrations/016).

ALTER TABLE families
  ADD COLUMN IF NOT EXISTS ui_locale TEXT NOT NULL DEFAULT 'vi'
    CHECK (ui_locale IN ('vi', 'en', 'ja', 'ko'));
