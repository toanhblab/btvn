-- Nhieu gia dinh dung chung mot app, phan biet bang ma PIN: PIN vua la danh tinh
-- vua la mat khau, nen HAI NHA KHONG DUOC TRUNG PIN. Neu trung thi nhap PIN se
-- tra ra nha cua nguoi khac — bai tap va anh chup cua con nha kia. Chan tu DB de
-- khong phu thuoc vao viec tang code nao cung nho kiem tra.
CREATE UNIQUE INDEX IF NOT EXISTS families_pin_idx ON families (parent_pin_hash);
