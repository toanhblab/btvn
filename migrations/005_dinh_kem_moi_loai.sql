-- Dinh kem khong chi con video: co giao con gui GHI AM mau doc va ANH (bang
-- chu cai, mau to mau...). Bang assignment_videos doi ten thanh assignment_media
-- va them cot kind de biet phai hien trinh phat nao o man cua con.
--
-- Dong nao co truoc migration nay deu la video that (thoi diem do chi upload
-- duoc video) nen DEFAULT 'video' dien dung gia tri cho du lieu cu.

ALTER TABLE assignment_videos RENAME TO assignment_media;
ALTER INDEX assignment_videos_asg_idx RENAME TO assignment_media_asg_idx;
ALTER TABLE assignment_media ADD COLUMN kind TEXT NOT NULL DEFAULT 'video' CHECK (kind IN ('video', 'audio', 'image'));
