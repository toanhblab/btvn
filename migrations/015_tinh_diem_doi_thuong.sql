-- Tinh diem cho cac con khi hoan thanh bai tap, va doi diem lay phan thuong
-- (bo me duyet). Luat captain chot:
--
--   +10  mot NGAY xong het (ca bai tap lan viec nha cua ngay do — dung cong thuc
--        "hom nay da xong" sau issue #36), cong MOT LAN cho moi (con, ngay).
--   +1   moi BAI xong SOM hon thoi luong du kien cua chinh bai do
--        (assignments.duration_minutes): con bam "Bat dau lam" roi tick xong
--        truoc khi dong ho het gio (xem lib/diem.ts va DongHoLamBai.tsx).
--   Khong hoi to: chi tinh tu ngay tinh nang len production tro di.
--
-- Bon thay doi:
--
-- 1. families.score_since — ngay bat dau tinh diem cua nha. DEFAULT CURRENT_DATE
--    nen NHA DANG CO nhan dung ngay migration nay chay tren DB that (= ngay len
--    production), nha tao sau nhan ngay tao. Ngay (due_date) truoc moc nay
--    KHONG duoc cong 10 diem du con tick xong sau do — day la cach "khong hoi
--    to" duoc ep tu du lieu, khong phai hang so trong code phai nho sua truoc
--    khi deploy. (Cung mot y voi migrations/011: lay moc thoi gian tu chinh DB.)
--    CURRENT_DATE theo mui gio cua DB (Neon: UTC), lech toi da mot ngay so voi
--    gio Viet Nam — chap nhan, vi todayISO() tren Vercel cung la UTC.
--
-- 2. assignments.started_at — moc con bam "Bat dau lam". Moc nay von chi song
--    trong localStorage cua iPad (DongHoLamBai.tsx); tu nay may con gui kem
--    luc tick xong (PATCH /api/assignments/:id { status, startedAt }) de may
--    chu xet "xong som" va luu lai cho bo me xem. NULL = con khong bam dong ho.
--
-- 3. score_events — so cong diem, MOI DONG LA MOT LAN CONG. Tong diem kiem duoc
--    = SUM(points). Chi ghi diem CONG; diem TRU do doi thuong doc tu
--    reward_redemptions (status = 'approved') — khong ghi mot dong am vao day de
--    khong phai giu hai bang khop nhau khi bo me duyet (lib/db.ts khong co
--    transaction qua Neon HTTP). So du = SUM(score_events.points)
--    - SUM(reward_redemptions.cost WHERE approved), xem soDiem trong lib/store.ts.
--
--    Hai unique index CHINH LA luat "cong mot lan": (child_id, event_date) cho
--    kind = 'day_complete', (assignment_id) cho kind = 'early_finish'. Store dung
--    ON CONFLICT DO NOTHING tren hai index nay — hai request tick dong thoi
--    (con bam lien tay) khong cong duoc hai lan.
--
--    assignment_id ON DELETE SET NULL, khong CASCADE: bo me xoa bai (hay xoa het
--    bai dau nam) khong duoc lam con mat diem da kiem — dung tien le cua
--    assignments.submission_id va assignments.chore_id (migrations/001, 013).
--    Xoa CON thi diem di theo (CASCADE), giong assignments.
--
--    Khong co cot family_id: thuoc nha nao la qua child_id -> children.family_id,
--    dung quy uoc cua assignments va daily_chore_checks.
--
-- 4. rewards + reward_redemptions — danh sach phan thuong bo me cau hinh (ten,
--    icon, gia diem), va yeu cau doi thuong cua con cho bo me duyet.
--    reward_redemptions CHEP ten/icon/gia luc con xin: bo me sua gia hay xoa
--    phan thuong sau do khong lam doi yeu cau dang cho, va lich su van doc
--    duoc (reward_id ON DELETE SET NULL). Moi con chi MOT yeu cau dang cho
--    (unique index partial theo status = 'pending') — con khong xin chong len
--    nhau, va khong can "giu cho" diem: du diem duoc kiem lai luc xin VA luc bo
--    me duyet.

ALTER TABLE families
  ADD COLUMN IF NOT EXISTS score_since DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS score_events (
  id            TEXT PRIMARY KEY,
  child_id      TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('day_complete', 'early_finish')),
  points        INTEGER NOT NULL CHECK (points > 0),
  -- Ngay cua bai (due_date), KHONG phai ngay tick: lam bai ngay mai vao toi
  -- nay thi diem tinh cho ngay mai, va mot ngay chi duoc cong mot lan.
  event_date    DATE NOT NULL,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS score_events_day_once_idx
  ON score_events (child_id, event_date)
  WHERE kind = 'day_complete';

CREATE UNIQUE INDEX IF NOT EXISTS score_events_early_once_idx
  ON score_events (assignment_id)
  WHERE kind = 'early_finish';

CREATE INDEX IF NOT EXISTS score_events_child_idx
  ON score_events (child_id, created_at);

CREATE TABLE IF NOT EXISTS rewards (
  id         TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT '🎁',
  cost       INTEGER NOT NULL CHECK (cost > 0),
  -- Tat thi con khong thay o cua hang nua nhung lich su doi van con; xoa that
  -- cung an toan vi reward_redemptions da chep ten/gia.
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rewards_family_idx ON rewards (family_id, cost);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id           TEXT PRIMARY KEY,
  child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  reward_id    TEXT REFERENCES rewards(id) ON DELETE SET NULL,
  reward_name  TEXT NOT NULL,
  reward_icon  TEXT NOT NULL,
  cost         INTEGER NOT NULL CHECK (cost > 0),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS reward_redemptions_child_idx
  ON reward_redemptions (child_id, requested_at);

CREATE UNIQUE INDEX IF NOT EXISTS reward_redemptions_pending_once_idx
  ON reward_redemptions (child_id)
  WHERE status = 'pending';
