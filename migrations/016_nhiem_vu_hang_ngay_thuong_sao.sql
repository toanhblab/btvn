-- Nhiem vu hang ngay co thuong sao (issue #42). Captain chot:
--
--   Q1  MOT HE, HAI NHOM. "Nhiem vu hang ngay" CHINH LA he viec nha dang chay
--       (daily_chores + dong assignments co chore_id), khong dung he thu hai.
--       Moi nhiem vu co them mot NHOM voi dung hai gia tri:
--         'after_study' — "Sau khi hoc xong": don dep, chuan bi do dung. Ba viec
--                         mac dinh dang co (cat sach vo, tat den, soan sach)
--                         thuoc nhom nay — DEFAULT cua cot, nen KHONG sua du
--                         lieu, KHONG doi id ba dong do.
--         'housework'   — "Viec nha hang ngay": viec nha cua con. Nhom MOI.
--   Q2  Nhiem vu hien MOI NGAY, ke ca cuoi tuan va ngay khong co bai — dong
--       cua ngay duoc tao LUOI khi mo man (taoNhiemVuNgay trong lib/store.ts),
--       khong con cho saveSubmission tao nua. Khong can cron.
--   Q3  Ba viec mac dinh duoc 1 sao moi viec (DEFAULT 1).
--   Q5  Sao CONG THEM: +10 ngay xong het va +1 xong som giu nguyen; moi dong
--       nhiem vu tick xong duoc them dung so sao cua no.
--   Q6  Khong rut sao khi bo tick — giong +1/+10, khong co dong diem am.
--   Q7  Moi nhiem vu: ten + icon mot emoji + sao 1..10 + nhom + "giao cho"
--       (NULL = ca nha, hoac danh sach id con).
--
-- Bon thay doi:
--
-- 1. daily_chores: them stars / icon / child_ids / category (cau hinh).
--    - stars CHECK 1..10: moi nhiem vu deu co sao, khong co "0 sao chi de nhac" —
--      tran 10 chan go nham (cung y MAX_GIA_PHAN_THUONG).
--    - child_ids TEXT[] NULL = ca nha. Mang thay cho bang noi: nha co 3 con,
--      `= ANY($n)` da dung san o lib/store.ts, va NULL lam ba viec mac dinh
--      khong can sua gi + con them sau tu duoc nhan. Xoa mot con de lai id la
--      trong mang thi vo hai (khong khop ai). Bang noi "dung sach" hon nhung
--      them mot join va mot bo CRUD cho dung mot gia dinh.
--    - category DEFAULT 'after_study' de ba dong dang co roi vao dung nhom.
--
-- 2. assignments.stars — dong cua tung ngay CHEP so sao luc tao (tien le: content
--    chep o 013, gia phan thuong chep o 015). NULL = bai tap that, HOAC dong
--    viec nha cu tao truoc migration nay. Dong NULL KHONG BAO GIO duoc sao —
--    day la cach "khong hoi to" ep tu du lieu: dong cua hom nay da tao truoc
--    khi len ban moi cung khong co sao, khong co migration nao cong bu.
--    Icon thi chep vao cot assignments.icon da co san (truoc day moi dong viec
--    nha deu la '🧹'). NHOM thi KHONG chep: doc live qua JOIN daily_chores nhu
--    sort_order (xem listAssignments) — nhom la chuyen "hien o dau", giong
--    thu tu, khong phai "duoc gi" nhu sao.
--
-- 3. score_events: them loai 'task_done' + unique index partial theo
--    assignment_id. Index nay CHINH LA luat "cong mot lan cho moi dong nhiem
--    vu" (khong nam trong code): tick lai, bo tick roi tick lai, hai request
--    den cung luc — store dung ON CONFLICT DO NOTHING ... RETURNING nen chi
--    mot lan cong. Dung khuon cua hai index o 015.
--
--    Sua CHECK cua score_events.kind bang DROP CONSTRAINT IF EXISTS + ADD lai
--    voi ten cu (score_events_kind_check — ten Postgres tu dat cho CHECK inline
--    o 015). Issue #43 (bo me tru diem) chay song song va da chot dung MOT BANG
--    PHAT RIENG, khong ghi dong am vao score_events, nen khong dong vao
--    constraint nay; neu sau nay co migration nao them kind nua thi phai liet
--    ke lai DU ca ba gia tri duoi day, khong duoc chi them gia tri cua minh.
--    points CHECK (> 0) giu nguyen: sao la so duong.
--
-- 4. Khong co gi bi xoa hay tao lai: ba viec mac dinh giu nguyen id (chi nhan
--    DEFAULT cho cot moi), lich su tick giu nguyen, diem da ghi giu nguyen.
--    Chay lai nhieu lan duoc (IF NOT EXISTS / IF EXISTS khap noi).

ALTER TABLE daily_chores
  ADD COLUMN IF NOT EXISTS stars     INTEGER NOT NULL DEFAULT 1
                                     CHECK (stars >= 1 AND stars <= 10),
  ADD COLUMN IF NOT EXISTS icon      TEXT    NOT NULL DEFAULT '🧹',
  ADD COLUMN IF NOT EXISTS child_ids TEXT[],
  ADD COLUMN IF NOT EXISTS category  TEXT    NOT NULL DEFAULT 'after_study'
                                     CHECK (category IN ('after_study', 'housework'));

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS stars INTEGER CHECK (stars IS NULL OR stars > 0);

ALTER TABLE score_events DROP CONSTRAINT IF EXISTS score_events_kind_check;

ALTER TABLE score_events
  ADD CONSTRAINT score_events_kind_check
  CHECK (kind IN ('day_complete', 'early_finish', 'task_done'));

CREATE UNIQUE INDEX IF NOT EXISTS score_events_task_once_idx
  ON score_events (assignment_id)
  WHERE kind = 'task_done';
