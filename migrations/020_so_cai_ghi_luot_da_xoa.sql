-- So cai video_cleanups ghi them LUOT NAO DA XOA THAT SU, khac voi luot da DINH xoa.
--
-- Hai luot nay khong phai luc nao cung la mot. Cau go URL chay TRUOC del() (hang
-- rao 5 o lib/donVideo.ts), nen mot cu del() hong de lai dong so cai co
-- `deleted_at IS NULL` va mot tep khong con ai tro toi; luot HOM SAU moi don not
-- duoc no. Dem theo `run_id` la dem theo luot DINH xoa, nen dong "Don video cu"
-- o man Cai dat bao "Da don ngay <hom sau> — 0 video cua nha minh" dung vao dem
-- ma video cua nha do vua that su bi xoa.
--
-- Cot nay chi duoc ghi CUNG LUC voi `deleted_at`, tuc chi sau khi kho bao xoa
-- xong: `deleted_run_id IS NOT NULL` = "luot do da pha that", khong phai "luot do
-- da dinh pha".
ALTER TABLE video_cleanups ADD COLUMN IF NOT EXISTS deleted_run_id TEXT;

CREATE INDEX IF NOT EXISTS video_cleanups_deleted_run_idx
  ON video_cleanups (deleted_run_id);
