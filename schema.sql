-- Lươc do DB — bam theo PRD muc 7.
-- Chay duoc tren ca Neon Postgres lan PGlite (dev).

CREATE TABLE IF NOT EXISTS families (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  -- Duong dan kho doan cho man cua con (PRD muc 10): con khong dang nhap nen
  -- link phai khong the doan ra tu ben ngoai.
  slug            TEXT NOT NULL UNIQUE,
  parent_pin_hash TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS children (
  id         TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  -- Anh that cua tung con la bat buoc (PRD muc 3): hai be sinh doi chua doc
  -- thao ten nen phai tu nhan ra minh bang anh + mau rieng.
  avatar_url TEXT NOT NULL,
  color      TEXT NOT NULL CHECK (color IN ('primary', 'secondary', 'tertiary')),
  grade      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Mot lan bo me nhap (dan text hoac up anh). Mot submission co the sinh ra bai
-- tap cho NHIEU con — day la truong hop hai be sinh doi hoc cung lop (PRD 4.2).
CREATE TABLE IF NOT EXISTS submissions (
  id         TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  raw_text   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submission_images (
  id            TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  blob_url      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  id            TEXT PRIMARY KEY,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  child_id      TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '📝',
  content       TEXT NOT NULL,
  note          TEXT,
  -- Quyet dinh giong doc o man cua con: de tieng Viet doc vi-VN, tieng Anh doc
  -- en-US. Doc chu tieng Anh bang giong Viet thi be 4 tuoi nghe khong hieu.
  lang          TEXT NOT NULL DEFAULT 'vi' CHECK (lang IN ('vi', 'en')),
  due_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done')),
  completed_at  TIMESTAMPTZ,
  image_url     TEXT
);

-- Man cua con luon truy van theo (con, ngay) nen danh index cho cap nay.
CREATE INDEX IF NOT EXISTS assignments_child_due_idx ON assignments (child_id, due_date);
