-- Don dinh ky video con da nop khoi kho tep. Kho Vercel Blob cua goi Hobby chi
-- co 1 GB va app truoc gio KHONG xoa tep nao, nen mot video camera iPad co the
-- chiem gan het cho.
--
-- LUAT (captain 2026-09-10, hai lan noi):
--   "nhung video da qua 5 ngay ve co ban khong can luu lai"
--   "do ngay nao con cung di hoc va co bai tap. Nen kieu gi cung phai nop bai
--    cho co. Vay nen chi can giu lai 3-5 cuoi cung la okie roi"
-- => xoa mot video khi CA HAI dieu kien cung dung: da qua 5 ngay, VA khong nam
-- trong 3 video moi nhat CUA CHINH DUA CON DO. Chi tiet o lib/donVideo.ts.
--
-- Hai bang, moi cai mot ly do rieng:
--
-- 1. video_cleanup_runs — MOI LUOT don mot dong. Chi muc UNIQUE tung phan tren
--    (run_date) CHI ap cho luot chay THAT: tai lieu cua Vercel noi thang cron
--    "co the goi cung mot luot hon mot lan", va hang rao chong chay trung phai
--    nam o CSDL chu khong o code (cung tien le voi "cong diem mot lan" cua
--    score_events). Luot chay THU khong bi chan vi no khong pha gi, va bo me
--    phai xem thu duoc bao nhieu lan tuy y truoc khi bat xoa that.
--
-- 2. video_cleanups — SO CAI: moi tep bi xoa mot dong, ghi cung luc voi luc go
--    URL va TRUOC khi tep bien mat. Xoa tep tren kho KHONG lui duoc, nen day la
--    ban sao duy nhat con lai cua duong dan da mat. CO Y khong dat khoa ngoai
--    sang assignments hay video_cleanup_runs: so cai phai song lau hon ca dong
--    bai tap lan dong luot chay — xoa bai tap di ma so cai bay theo thi khong
--    con bang chung nao.

CREATE TABLE IF NOT EXISTS video_cleanup_runs (
  id          TEXT PRIMARY KEY,
  run_date    DATE NOT NULL,
  -- 'thu' = chay thu, chi liet ke; 'that' = xoa that
  che_do      TEXT NOT NULL CHECK (che_do IN ('thu', 'that')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  so_tep      INTEGER NOT NULL DEFAULT 0,
  so_bytes    BIGINT NOT NULL DEFAULT 0,
  loi         TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS video_cleanup_runs_that_idx
  ON video_cleanup_runs (run_date) WHERE che_do = 'that';

CREATE TABLE IF NOT EXISTS video_cleanups (
  id                 TEXT PRIMARY KEY,
  run_id             TEXT NOT NULL,
  assignment_id      TEXT NOT NULL,
  child_id           TEXT NOT NULL,
  url                TEXT NOT NULL,
  bytes              BIGINT,
  submitted_video_at TIMESTAMPTZ,
  -- Ghi luc dinh xoa; deleted_at chi duoc dien sau khi kho bao xoa xong. Mot
  -- dong co planned_at ma khong co deleted_at = luot chay dut giua chung.
  planned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS video_cleanups_run_idx ON video_cleanups (run_id);
