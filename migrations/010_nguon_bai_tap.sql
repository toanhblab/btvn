-- Bai tap den tu HAI noi: lop hoc them tieng Anh va truong tieu hoc. Con can
-- thay hai nhom rieng de lam xong het mot loai roi moi chuyen sang loai kia.
--
-- Gia tri: 'english_class' | 'primary_school'. KHONG dat CHECK de sau nay them
-- nguon moi (lop ve, lop nhac...) khong can migration — app tu loc gia tri la
-- (hwSourceOf trong lib/types.ts) truoc khi ghi.
--
-- Du lieu cu: mac dinh 'primary_school' — truong tieu hoc la noi giao nhieu bai
-- nhat. Rieng bai co lang = 'en' (de bai tieng Anh nguyen van) gan nhu chac chan
-- den tu lop tieng Anh nen dien lai cho dung.

ALTER TABLE submissions ADD COLUMN source TEXT;

ALTER TABLE assignments ADD COLUMN source TEXT NOT NULL DEFAULT 'primary_school';
UPDATE assignments SET source = 'english_class' WHERE lang = 'en';
