-- Cua nhan bai co giao dang tren nhom Zalo cua lop (captain 2026-09-20/21).
--
-- Dong chay: zalo-agent (kho rieng, chay tren Mac mini) doc tin cua co trong
-- nhom Zalo, goi POST /api/nhan-bai-zalo kem khoa bi mat. btvn luu BAN GOC cua
-- tin, chay bo tach bai san co, va tao bai NHAP cho tung con cua nguon. Bo me
-- doc nguyen van tin roi bam duyet MOT CHAM thi bai moi thanh that va hien tren
-- man cua con. Captain chot: "cần bố mẹ duyệt", "cấu hình nhóm zalo ứng với
-- từng con", va MOI thu (ten nhom, ten co, mau nhan dien) phai cau hinh duoc,
-- khong ghi cung trong ma.
--
-- Ba bang + hai cot, moi cai mot ly do rieng:
--
-- 1. nguon_zalo — MOT nhom Zalo cua mot lop. btvn la NGUON SU THAT DUY NHAT cua
--    cau hinh nay: zalo-agent doc lai qua GET /api/nhan-bai-zalo/cau-hinh moi
--    lan chay, nen captain chi khai bao mot cho (man bo me).
--    `mau_nhan_dien` la danh sach chuoi KHONG DAU ma zalo-agent doi chieu voi
--    tin (no tu fold dau truoc khi so) — mac dinh theo do cua scout tren 686 tin
--    that: tin giao bai luon co ca "bai tap ve nha" va "ngay hoc thu".
--    `cua_so_dinh_kem_phut` la khoang thoi gian SAU tin ma tep gui trong do duoc
--    coi la tep cua bai (do duoc: video mau toi sau tin 4 giay, con tep nhan xet
--    tung be toi sau ~4 tieng — cua so 90 phut tach dung hai loai).
--    KHONG co cot nao luu khoa bi mat: khoa la bien moi truong ZALO_INTAKE_SECRET,
--    giong CRON_SECRET.
--
-- 2. nguon_zalo_con — "hai con cung lop thi gan bai cho ca hai cung luc"
--    (captain). Bang noi chu khong phai mang TEXT[] nhu daily_chores.child_ids:
--    o day khong co trang thai "ca nha" (mot nhom Zalo LA mot lop, chi nhung con
--    hoc lop do moi nhan bai), nen tap rong co nghia that su la "chua gan con
--    nao" va khoa ngoai co ON DELETE CASCADE lam sach khi xoa con — khong de lai
--    id chet nhu mang.
--
-- 3. bai_tu_zalo — BAN GOC cua mot tin. Giu nguyen van de bo me DOI CHIEU truoc
--    khi duyet (captain 2026-09-20: "hãy có 1 đoạn nguyên văn tin nhắn của cô
--    gửi trong zalo, lưu ý có cả ngày giờ gửi"), va giu ca `ket_qua_tach` — ban
--    tach cua AI truoc khi bo me sua — de sau nay con doi chieu duoc bo tach
--    doc dung den dau.
--    `ma_tin` UNIQUE THEO NGUON: id tin cua Zalo duy nhat trong mot nhom, va
--    zalo-agent chay lai moi 30 phut nen goi trung la binh thuong, khong phai
--    loi — cua nhan tra 409 va khong tao gi. Rang buoc nay nam o CHI MUC chu
--    khong o code, cung tien le voi "cong diem mot lan" (migrations/015) va
--    "mot luot don video moi ngay" (019): hai request cung luc thi CSDL chan.
--    `nhan_dien` la co zalo-agent gui kem (luat khop hay Jev cham) — btvn chi
--    LUU va HIEN, khong co logic nao doc no; thieu thi khong hien co nao.
--
-- 4. assignments.zalo_bai_id + assignments.trang_thai_duyet — dong NHAP.
--
--    Vi sao bai nhap nam trong CHINH bang assignments chu khong trong mot bang
--    rieng: bo me phai SUA duoc tung bai truoc khi duyet, va moi duong sua bai
--    (PATCH /api/assignments/:id, man SuaBai, lam sach tham so, kiem so huu theo
--    nha) da co san va da duoc kiem ky. Mot bang nhap rieng se phai nhan doi het
--    chung, roi lech nhau.
--
--    DEFAULT 'that' la ban le cua ca thiet ke: moi dong da co va MOI cau INSERT
--    dang co (saveSubmission, SQL_TAO_NHIEM_VU_NGAY, hai script seed) khong phai
--    sua mot chu ma van dung nhu cu. Chi duong Zalo ghi 'nhap'.
--
--    Doi lai, MOI cau DOC assignments phai noi ro no muon gi. Da ra soat het
--    bang grep va liet ke trong PR; hang rao thuc su la `CHI_BAI_THAT` trong
--    lib/store.ts (mac dinh loai dong nhap, noi goi phai xin ro moi thay) —
--    cung khuon voi `includeChores` cua issue #36.
--
--    ON DELETE SET NULL, KHONG phai CASCADE: bai DA DUYET van la bai that cua
--    con: xoa dong bai_tu_zalo (hay ca nguon) khong duoc phep keo theo bai tap
--    con dang lam do. Dong nhap thi duong "Không phải bài" xoa tuong minh.

CREATE TABLE IF NOT EXISTS nguon_zalo (
  id                   TEXT PRIMARY KEY,
  family_id            TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  ten_nhom             TEXT NOT NULL,
  -- Ma nhom cua Zalo ('g6948518348545773767'). Nullable: bo me khai bao bang TEN
  -- nhom (thu ho nhin thay), zalo-agent dien ma vao sau khi mo dung nhom.
  ma_nhom              TEXT,
  ten_co               TEXT NOT NULL,
  mau_nhan_dien        JSONB   NOT NULL DEFAULT '["bai tap ve nha", "ngay hoc thu"]'::jsonb,
  cua_so_dinh_kem_phut INTEGER NOT NULL DEFAULT 90
                               CHECK (cua_so_dinh_kem_phut > 0 AND cua_so_dinh_kem_phut <= 1440),
  dang_bat             BOOLEAN NOT NULL DEFAULT TRUE,
  -- Lan cua nhan bai nhan duoc mot tin cua nguon nay. Man bo me hien no de mot
  -- nguon da chet am tham (Zalo dang xuat, co doi ten) nhin la thay.
  lan_nhan_gan_nhat    TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nguon_zalo_family_idx ON nguon_zalo (family_id);

CREATE TABLE IF NOT EXISTS nguon_zalo_con (
  nguon_id TEXT NOT NULL REFERENCES nguon_zalo(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id)   ON DELETE CASCADE,
  PRIMARY KEY (nguon_id, child_id)
);

CREATE INDEX IF NOT EXISTS nguon_zalo_con_child_idx ON nguon_zalo_con (child_id);

CREATE TABLE IF NOT EXISTS bai_tu_zalo (
  id             TEXT PRIMARY KEY,
  nguon_id       TEXT NOT NULL REFERENCES nguon_zalo(id) ON DELETE CASCADE,
  ma_tin         TEXT NOT NULL,
  gui_luc        TIMESTAMPTZ,
  nguoi_gui      TEXT NOT NULL DEFAULT '',
  nhom_zalo      TEXT NOT NULL DEFAULT '',
  ngay_hoc_so    INTEGER,
  ngay_trong_tin DATE,
  nguyen_van     TEXT NOT NULL,
  -- [{ ten, loai, kind, url, bytes, gui_luc, han_xoa }] — xem lib/zalo.ts.
  dinh_kem       JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- { luat: bool, jev_xac_suat: number|null } do zalo-agent gui; null = khong gui.
  nhan_dien      JSONB,
  trang_thai     TEXT NOT NULL DEFAULT 'nhap'
                      CHECK (trang_thai IN ('nhap', 'da_duyet', 'bo')),
  -- Ban tach cua AI TRUOC khi bo me sua: { nguon: 'ai'|'rule', bai: [...] }.
  ket_qua_tach   JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bai_tu_zalo_ma_tin_idx ON bai_tu_zalo (nguon_id, ma_tin);
CREATE INDEX IF NOT EXISTS bai_tu_zalo_cho_duyet_idx ON bai_tu_zalo (nguon_id, created_at DESC);

-- `zalo_thu_tu`: THU TU bo tach bai xep cac bai ra, tuc thu tu CO GIAO VIET
-- trong tin. Man cho duyet dat nguyen van tin CANH danh sach bai da tach de bo
-- me doi chieu, ma `listAssignments` sap theo `due_date, subject, ... a.id` —
-- `a.id` sinh ngau nhien, nen khong co cot nay thi danh sach bi xao tung: "Phần
-- tiếng anh" nhay len tren "Phần Jolly Phonics" va bo me phai do tung dong.
-- Cung ly do voi `daily_chores.sort_order` (xem ORDER BY trong listAssignments).
-- NULL o moi dong khac — chi dong tu Zalo moi co thu tu de giu.
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS zalo_bai_id      TEXT REFERENCES bai_tu_zalo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zalo_thu_tu      SMALLINT,
  ADD COLUMN IF NOT EXISTS trang_thai_duyet TEXT NOT NULL DEFAULT 'that'
                                            CHECK (trang_thai_duyet IN ('nhap', 'that'));

CREATE INDEX IF NOT EXISTS assignments_zalo_bai_idx
  ON assignments (zalo_bai_id) WHERE zalo_bai_id IS NOT NULL;
