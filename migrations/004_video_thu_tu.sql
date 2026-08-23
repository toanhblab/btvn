-- Giu dung thu tu video nhu luc bo me them: id sinh ngau nhien nen ORDER BY id
-- lam video dao lon xon moi lan doc. Ghi hin thu tu vao cot rieng.

ALTER TABLE assignment_videos ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
