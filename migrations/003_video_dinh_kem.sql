-- Video dinh kem theo TUNG BAI: vi du bai tieng Anh co video co giao gui de
-- luyen phat am. Mot bai co the co nhieu video, va cung mot video (cung URL)
-- co the duoc gan vao bai cua nhieu con — moi con mot dong rieng, giong nhu
-- moi con co mot ban bai tap rieng.
--
-- Khong nhet video vao submissions: video la thu CON XEM o man chi tiet bai,
-- khong phai nguyen lieu tach bai nhu anh chup, nen phai di theo assignment.

CREATE TABLE IF NOT EXISTS assignment_videos (
  id            TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  -- Ten tep goc de bo me nhan ra video nao la video nao khi gan vao bai
  name          TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS assignment_videos_asg_idx ON assignment_videos (assignment_id);
