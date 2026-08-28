-- Nguon thu ba: 'other' (Khac). Chuyen sang do NHUNG BAI CHUA TUNG DUOC PHAN LOAI.
--
-- Trong DB khong co bai nao trong nguon: 010_nguon_bai_tap.sql da gan het
-- ('primary_school' mac dinh, 'english_class' cho bai lang = 'en'). Nen "chua
-- phan loai" phai hieu theo CACH bai do co nhan, khong theo nhan hien tai:
--
--   GIU NGUYEN  bai 'english_class' — 010 gan vi de bai tieng Anh, la bang chung
--               that chu khong phai mac dinh.
--   GIU NGUYEN  moi bai tao SAU khi 010 chay — AI da doan nguon va bo me duyet lai
--               duoc ngay o man Kiem tra lai.
--   CHUYEN      bai tao TRUOC khi 010 chay va dang mang mac dinh 'primary_school'
--               — khong ai tung phan loai no, no chi hung cai DEFAULT.
--
-- Moc thoi gian: _migrations.applied_at cua '010_nguon_bai_tap.sql' so voi luc bai
-- duoc tao. Bang assignments KHONG co created_at, moc duy nhat co that la
-- submissions.created_at (dot nhap sinh ra bai) — moi bai deu di tu mot submission
-- (lib/store.ts). Bai bi mat submission (ON DELETE SET NULL) thi khong con moc nao
-- de xet nen GIU NGUYEN, theo dung nguyen tac thà không làm gì còn hơn gom nhầm.
--
-- QUAN TRONG: neu KHONG tim thay dong _migrations cho '010_nguon_bai_tap.sql' thi
-- migration nay KHONG DOI GI CA. Cau SELECT long nhau tra ve NULL, phep so sanh
-- thanh NULL, WHERE khong khop dong nao. Do la co y: khong biet moc thoi gian thi
-- tha khong lam gi con hon gom nham hang loat bai dung vao "Khac".
--
-- CHO BIET truoc: moc thoi gian tao bai KHONG phan biet duoc "chua ai dong vao"
-- voi "bo me tao truoc 010, sau do vao Sua bai bam dung 🏫 Nguyen Sieu" —
-- assignments khong co updated_at nen khong co tin hieu nao trong schema tach hai
-- truong hop. Nhung bai loai hai bi gom nham sang "Khac". Vi vay TRUOC khi doi,
-- moi dong sap doi duoc ghi lai vao _nguon_reclassify_011 de con duong lui.
--
-- Ca hai cau hoan tac duoi day chi dung den dong nao con dang mang DUNG gia tri
-- ma migration nay ghi ('other') — AND a.source = 'other'. Hoan tac khong dieu
-- kien se ghi de chinh lua chon co y cua bo me sau khi migration chay (tao truoc
-- 010, bi gom sang "Khac", roi bo me vao Sua bai bam 🇬🇧 Smartkid): dung cai
-- silent-loss ma bang _nguon_reclassify_011 sinh ra de chan, tai xuat hien tren
-- chinh duong phuc hoi. Nguoi sua sau luon thang cai may ghi truoc.
--
-- HOAN TAC TOAN BO (tra ve nguon cu nhung dong migration con dang giu):
--
--   UPDATE assignments a
--      SET source = r.source_cu
--     FROM _nguon_reclassify_011 r
--    WHERE r.assignment_id = a.id
--      AND r.migration = '011_nguon_khac.sql'
--      AND a.source = 'other';  -- het cau
--
-- HOAN TAC MOT BAI (thay <assignment_id> bang id that):
--
--   UPDATE assignments a
--      SET source = r.source_cu
--     FROM _nguon_reclassify_011 r
--    WHERE r.assignment_id = a.id
--      AND r.migration = '011_nguon_khac.sql'
--      AND a.source = 'other'
--      AND a.id = '<assignment_id>';  -- het cau
--
-- (Dau ';' trong hai cau tren co chu "-- het cau" theo sau vi scripts/db.mjs cat
-- tep .sql o moi dau ';' cuoi dong; de tran thi hai khoi comment nay bi doc nham
-- thanh cau lenh.)
--
-- LUU Y VAN HANH — chi cho DB PHAT TRIEN CUC BO: tep 011 nay duoc sua sau khi ban
-- dau (chi mot cau UPDATE, chua co bang phuc hoi) da tung chay o vai DB cuc bo.
-- chayMigrations bo qua tep da co ten trong _migrations nen tren nhung DB do,
-- _nguon_reclassify_011 KHONG duoc tao va hai cau hoan tac tren bao "relation
-- does not exist".
--
-- Tren nhung DB do, DOT CHUYEN LA MAT VINH VIEN, KHONG HOAN TAC DUOC. Ban 011 cu
-- dung y het dieu kien loc voi ban nay, nen moi bai dinh da mang source = 'other'
-- tu truoc va khong con dau vet gi de biet truoc do no la 'primary_school'.
--
-- DUNG TUONG xoa dong _migrations la khoi phuc duoc. Neu chay
-- DELETE FROM _migrations WHERE name = '011_nguon_khac.sql' roi migrate lai thi:
-- bang _nguon_reclassify_011 duoc TAO NHUNG RONG (cau INSERT ghi log khop 0 dong
-- vi khong con dong nao con la 'primary_school'), cau UPDATE chinh cung 0 dong, va
-- sau do hai cau hoan tac chay THANH CONG nhung sua 0 dong. Khong loi nao hien ra
-- — de tuong nham la da co duong lui, trong khi khong co. Viec xoa dong _migrations
-- CHI TAT thong bao "relation does not exist", KHONG cuu du lieu.
--
-- Cach sach DUY NHAT cho DB phat trien cuc bo: XOA HAN .data/pg roi migrate lai tu
-- dau. KHONG ap dung cho production hay Vercel preview: nhanh nay chua tung duoc
-- push nen o do 011 chi chay dung mot lan, voi ban day du co bang phuc hoi.

CREATE TABLE IF NOT EXISTS _nguon_reclassify_011 (
  assignment_id TEXT PRIMARY KEY,
  source_cu     TEXT NOT NULL,
  doi_luc       TIMESTAMPTZ NOT NULL DEFAULT now(),
  migration     TEXT NOT NULL
);

INSERT INTO _nguon_reclassify_011 (assignment_id, source_cu, migration)
SELECT a.id, a.source, '011_nguon_khac.sql'
  FROM assignments a
 WHERE a.source = 'primary_school'
   AND EXISTS (
         SELECT 1
           FROM submissions s
          WHERE s.id = a.submission_id
            AND s.created_at < (
                  SELECT m.applied_at
                    FROM _migrations m
                   WHERE m.name = '010_nguon_bai_tap.sql'
                )
       )
    ON CONFLICT (assignment_id) DO NOTHING;

UPDATE assignments a
   SET source = 'other'
 WHERE a.source = 'primary_school'
   AND EXISTS (
         SELECT 1
           FROM submissions s
          WHERE s.id = a.submission_id
            AND s.created_at < (
                  SELECT m.applied_at
                    FROM _migrations m
                   WHERE m.name = '010_nguon_bai_tap.sql'
                )
       );
