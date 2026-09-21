/**
 * Cua nhan bai tu Zalo (migration 021) — chay THAT tren PGlite trong RAM, qua
 * CHINH hai route handler (`app/api/nhan-bai-zalo/*`) va CHINH lib/store.ts,
 * khong mo phong lai SQL. Duoc vay nho scripts/test-hook.mjs (resolve import
 * khong duoi) + BTVN_PGLITE_DIR=memory://, giong lib/nha-demo.test.ts; goi route
 * handler thang thi giong lib/donVideo.test.ts va lib/nha-link.test.ts.
 *
 * Goi tin mau la GOI THAT (tin "ngay hoc thu 40" cua co Thu Huyen) — dinh nghia
 * o lib/zalo.test.ts, import sang day de chi co MOT ban.
 *
 * Nhung dieu de vo ma khong ai thay, kiem o day:
 *
 *   1. HOP DONG HTTP. 503 khi may chu chua co khoa (KHAC 401: mot ban deploy
 *      thieu bien phai bao dung benh), 401 khi thieu/sai khoa, 404 khi nguon la
 *      / dang tat, 409 khi trung `ma_tin` VA khong tao them gi, 201 khi xong.
 *   2. BAI NHAP VO HINH VOI CON. Day la ca bo hang rao cua `CHI_BAI_THAT`
 *      (lib/store.ts) cung mot luot: man cua con khong liet ke, con so tom tat
 *      khong dem, con khong tick duoc du doan ra id, va — cai de bo sot nhat —
 *      mot dong nhap 'todo' KHONG duoc chan +10 cua ca ngay.
 *   3. DUYET MOT CHAM. Bai thanh that, hien ngay o man cua con, va dem vao
 *      progressUpcoming; bam lan hai tra 'da-xu-ly' chu khong duyet lai.
 *   4. "KHONG PHAI BAI". Bai nhap bi xoa, dong tin O LAI de lan quet sau cua
 *      zalo-agent van bi 409 chan — khong thi bo me phai bo lai moi 30 phut.
 *   5. TEP. Tep KHONG di trong than request (Vercel chan o 4.5MB): agent xin ve
 *      o `/api/nhan-bai-zalo/tep-token` roi tai thang len kho, goi tin chi mang
 *      `url`. Nen o day kiem: ve chi duoc phat cho `zalo/<nguon>/<ngay>/`, chi
 *      duoc phat cho nhung tin ma cua nhan tin cung nhan (nguon con song,
 *      `ma_tin` chua co), va su kien `blob.upload-completed` do may chu Vercel
 *      Blob goi ve KHONG bi chan — no khong mang khoa Bearer; goi mang url cua
 *      nguon KHAC / ngoai kho thi tep do bi bo va BAO RA ma tin van vao; so byte
 *      lay tu KHO chu khong tu con so agent khai; mot loi TAM THOI cua kho khong
 *      duoc lam mat tep; va CUA SO NHAN TEP cua nguon duoc AP that — o ca cua
 *      phat ve (422) lan cua nhan tin (`tep_bo_qua`).
 *   6. KHONG NHIN SANG NHA KHAC. `nguon_id` la thu quyet dinh nha, nen mot
 *      nguon cua nha A khong bao gio tao duoc bai cho con nha B — va nguon cua
 *      NHA DEMO khong bao gio lot vao cua danh cho may.
 */

import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

process.env.BTVN_PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
delete process.env.DATABASE_URL_UNPOOLED; delete process.env.POSTGRES_URL_NON_POOLING;
delete process.env.NOUS_API_KEY;            // ep duong lui splitByRule, ket qua on dinh
// Dung khuon `vercel_blob_rw_<maKho>_<bi mat>` va KHOP voi host cua `KHO`:
// token sai khuon la khong co ma kho, va khi do moi url Blob bi tu choi.
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_kho_bimatgia';

/**
 * Kho tep gia. `tepTrenKho` la "nhung tep agent da tai len" — cua nhan hoi kho
 * bang `head()` de biet tep co that va nang bao nhieu, nen day la cho dung de
 * dung mot tep vao truoc khi gui goi tin.
 */
const tepTrenKho = new Map<string, number>();
/** Moi lan `head` duoc goi — de kiem cua nhan co hoi kho that khong. */
const daHoiKho: string[] = [];
/**
 * Dat mot loi vao day thi `head()` NEM no thay vi tra loi. Dung de phan biet hai
 * cau tra loi rat khac nhau ma bo kiem cu gop lam mot: "kho noi ro khong co tep"
 * (BlobNotFoundError) va "khong hoi duoc kho luc nay" (rate-limit, 5xx).
 */
let khoNemLoi: unknown = null;
/** Lop loi THAT cua @vercel/blob — `instanceof` chi dung khi dung chinh lop do. */
const { BlobNotFoundError, BlobServiceRateLimited } = await import('@vercel/blob');
mock.module('@vercel/blob', {
  namedExports: {
    BlobNotFoundError,
    BlobServiceRateLimited,
    put: async () => { throw new Error('cua nhan bai Zalo khong duoc tu tai tep len kho'); },
    del: async () => {},
    head: async (url: string) => {
      daHoiKho.push(url);
      if (khoNemLoi) throw khoNemLoi;
      const size = tepTrenKho.get(url);
      if (size === undefined) throw new BlobNotFoundError();
      return { url, size };
    },
  },
});

/**
 * Ban gia RAT MONG cua `handleUpload`. Du hai viec: goi lai `onBeforeGenerateToken`
 * de phep kiem duong dan cua route van chay that, va GHI LAI moi than da toi
 * duoc tay no. Cai thu hai moi la cai can ghim: su kien `blob.upload-completed`
 * do may chu cua Vercel Blob goi ve callbackUrl KHONG mang `Authorization:
 * Bearer` (no ky bang `x-vercel-signature`, va handleUpload that tu kiem chu ky
 * do), nen mot route tu chan bang 401 o tang tren se lam moi luot tai tep bao
 * loi ve cho ben tai.
 */
const veDaKy: string[] = [];
const suKienHoanTat: string[] = [];
mock.module('@vercel/blob/client', {
  namedExports: {
    // lib/media.ts (duong tai tep cua TRINH DUYET) cung nam trong cay import cua
    // hai route nay — gia ca module thi phai gia du ten no xuat, khong thi
    // module do vo luc nap.
    upload: async () => { throw new Error('cua Zalo khong di qua upload() cua trinh duyet'); },
    handleUpload: async ({ body, onBeforeGenerateToken, onUploadCompleted }: {
      body: { type: string; payload: Record<string, unknown> };
      onBeforeGenerateToken: (p: string, cp: unknown, id: string | null) => Promise<object>;
      onUploadCompleted: (a: unknown) => Promise<void>;
    }) => {
      if (body.type === 'blob.generate-client-token') {
        const pathname = String(body.payload.pathname);
        const cau = await onBeforeGenerateToken(pathname, body.payload.clientPayload ?? null, null);
        veDaKy.push(pathname);
        return { type: 'blob.generate-client-token', clientToken: `ve-gia:${pathname}`, ...cau };
      }
      const blob = body.payload.blob as { pathname?: string } | undefined;
      suKienHoanTat.push(String(blob?.pathname ?? ''));
      await onUploadCompleted({ body });
      return { type: 'blob.upload-completed', response: 'ok' };
    },
  },
});

const { chayMigrations } = await import('../scripts/db.mjs');
const { query, queryTx } = await import('./db.ts');

/**
 * `saveSubmission` la buoc CUOI cua cua nhan tin, chay SAU khi dong `bai_tu_zalo`
 * da commit. Dat mot loi vao day de dung lai dung ca do: mot cu hong CSDL thoang
 * qua giua chung, sau diem khong quay lai duoc. Khong gia duoc thi khong kiem
 * duoc rang tin van 201 va van co duong "Tách lại".
 */
let saveSubmissionNem: Error | null = null;
const store = await import('./store.ts');
mock.module('./store.ts', {
  namedExports: {
    ...store,
    saveSubmission: async (input: Parameters<typeof store.saveSubmission>[0]) => {
      if (saveSubmissionNem) throw saveSubmissionNem;
      return store.saveSubmission(input);
    },
  },
});
const zaloStore = await import('./nhanBaiZalo.ts');
const { veTrenManCuaCon } = await import('./nhomNhiemVu.ts');
const { GOI_MAU, KHO, KHO_LA } = await import('./zalo.test.ts');
const { POST } = await import('../app/api/nhan-bai-zalo/route.ts');
const { GET: GET_CAU_HINH } = await import('../app/api/nhan-bai-zalo/cau-hinh/route.ts');
const { POST: POST_TOKEN } = await import('../app/api/nhan-bai-zalo/tep-token/route.ts');

const KHOA = 'khoa-dev-gia';
const FAM = 'fam_zalo';
const FAM_KHAC = 'fam_khac';
/** Id nha demo do `idNhaDemo` cua scripts/seed-demo.mjs dat ra — hang rao 9. */
const FAM_DEMO = 'fam_demo_vi';
const CON_A = 'con_binh';
const CON_B = 'con_an';
const CON_KHAC = 'con_nha_khac';
const CON_DEMO = 'con_demo';
const NGUON = 'nzl_cambridge';
const NGUON_TAT = 'nzl_tat';
const NGUON_KHAC = 'nzl_nha_khac';
const NGUON_DEMO = 'nzl_demo';

const db = {
  query: (t: string, p: unknown[] = []) => query<Record<string, unknown>>(t, p),
  chayGoi: async (cau: { sql: string; params?: unknown[] }[]) => { await queryTx(cau); },
};

/** Dung san tep tren kho gia cho moi `url` mot goi tin se mang len. */
const datTepLenKho = (goi: { dinh_kem?: { url?: string; kich_thuoc?: number }[] }) => {
  for (const t of goi.dinh_kem ?? []) {
    if (t.url) tepTrenKho.set(t.url, t.kich_thuoc ?? 1024);
  }
};

const xinVe = (
  tham: string,
  than: unknown,
  khoa: string | null = KHOA
) =>
  POST_TOKEN(new Request(`http://localhost/api/nhan-bai-zalo/tep-token?${tham}`, {
    method: 'POST',
    headers: khoa === null
      ? { 'content-type': 'application/json' }
      : { 'content-type': 'application/json', authorization: `Bearer ${khoa}` },
    body: JSON.stringify(than),
  }));

/**
 * Hai moc gio BAT BUOC cua cua ve, o dang da percent-encode ('+' cua mui gio
 * phai thanh %2B). Mac dinh la ca THAT: video mau toi sau tin 4 giay.
 */
const gioVe = (tin: string | null = GOI_MAU.gui_luc, tep: string | null = GOI_MAU.dinh_kem[0].gui_luc) =>
  [tin === null ? '' : `tin_gui_luc=${encodeURIComponent(tin)}`,
   tep === null ? '' : `tep_gui_luc=${encodeURIComponent(tep)}`].filter(Boolean).join('&');

/** Than `blob.generate-client-token` ma @vercel/blob/client gui len. */
const thanXinVe = (pathname: string) => ({
  type: 'blob.generate-client-token',
  payload: {
    pathname,
    callbackUrl: 'http://localhost/api/nhan-bai-zalo/tep-token',
    clientPayload: null,
    multipart: false,
  },
});

const goiCua = (than: unknown, khoa: string | null = KHOA) =>
  POST(new Request('http://localhost/api/nhan-bai-zalo', {
    method: 'POST',
    headers: khoa === null
      ? { 'content-type': 'application/json' }
      : { 'content-type': 'application/json', authorization: `Bearer ${khoa}` },
    body: JSON.stringify(than),
  }));

const demBaiCuaNguon = async (): Promise<number> =>
  Number((await db.query(
    `SELECT COUNT(*) AS n FROM assignments a WHERE a.zalo_bai_id IS NOT NULL`))[0].n);

before(async () => {
  await chayMigrations(db);
  for (const [fam, ten, slug, pin] of [
    [FAM, 'Nhà mình', 'nha-minh', 'hash-1'],
    [FAM_KHAC, 'Nhà khác', 'nha-khac', 'hash-2'],
    [FAM_DEMO, 'Nhà demo', 'nha-demo', 'hash-3'],
  ]) {
    await db.query(
      `INSERT INTO families (id, name, slug, parent_pin_hash, score_since)
       VALUES ($1,$2,$3,$4, CURRENT_DATE - 30)`, [fam, ten, slug, pin]);
  }
  for (const [id, fam, ten, mau, thuTu] of [
    [CON_A, FAM, 'Huy Bình', 'primary', 1],
    [CON_B, FAM, 'Huy An', 'secondary', 2],
    [CON_KHAC, FAM_KHAC, 'Bé Na', 'primary', 1],
    [CON_DEMO, FAM_DEMO, 'Bé Demo', 'primary', 1],
  ] as const) {
    await db.query(
      `INSERT INTO children (id, family_id, name, avatar_url, color, grade, sort_order)
       VALUES ($1,$2,$3,'/img/x.jpg',$4,'Lớp 1',$5)`, [id, fam, ten, mau, thuTu]);
  }
  for (const [id, fam, ten, bat] of [
    [NGUON, FAM, 'Cambridge 1.27 - Smart Kids Education', true],
    [NGUON_TAT, FAM, 'Lớp đã nghỉ', false],
    [NGUON_KHAC, FAM_KHAC, 'Lớp nhà khác', true],
    // Nha demo duoc seed lai moi ban build voi DUNG ten nhom cua lop that.
    [NGUON_DEMO, FAM_DEMO, 'Cambridge 1.27 - Smart Kids Education', true],
  ] as const) {
    await db.query(
      `INSERT INTO nguon_zalo (id, family_id, ten_nhom, ten_co, dang_bat)
       VALUES ($1,$2,$3,'Thu Huyền',$4)`, [id, fam, ten, bat]);
  }
  for (const [nguon, con] of [
    [NGUON, CON_A], [NGUON, CON_B], [NGUON_TAT, CON_A], [NGUON_KHAC, CON_KHAC],
    [NGUON_DEMO, CON_DEMO],
  ]) {
    await db.query(`INSERT INTO nguon_zalo_con (nguon_id, child_id) VALUES ($1,$2)`, [nguon, con]);
  }
});

beforeEach(async () => {
  daHoiKho.length = 0;
  khoNemLoi = null;
  saveSubmissionNem = null;
  veDaKy.length = 0;
  suKienHoanTat.length = 0;
  tepTrenKho.clear();
  datTepLenKho(GOI_MAU);
  process.env.ZALO_INTAKE_SECRET = KHOA;
  // Moi bai kiem bat dau tu mot CSDL sach phan Zalo + bai tap, nhung GIU nha,
  // con va nguon: chung la khung canh chung, khong phai du lieu cua tung bai.
  await db.query(`DELETE FROM assignments`);
  await db.query(`DELETE FROM bai_tu_zalo`);
  await db.query(`DELETE FROM score_events`);
  await db.query(`DELETE FROM daily_chores`);
  await db.query(`DELETE FROM submissions`);
  await db.query(`UPDATE nguon_zalo SET lan_nhan_gan_nhat = NULL`);
});

/**
 * Goi mau co han nop roi dung HOM NAY: `hanNopBai` = ngay trong tin + 1, nen
 * mot tin cua HOM QUA ra bai cho hom nay. Phai la hom nay thi cac bai kiem
 * "man cua con thay / khong thay" moi noi duoc dieu chung dinh noi — bai co han
 * NGAY MAI thi man cua con khong ve (issue #62) va hang rao `CHI_BAI_THAT` se
 * duoc ghi cong oan.
 */
const goiHanHomNay = (them: Record<string, unknown> = {}) =>
  ({ ...GOI_MAU, ngay_trong_tin: store.todayISO(-1), ...them });

/* ---------------- 1. Hop dong HTTP ---------------- */

test('503 khi may chu chua dat ZALO_INTAKE_SECRET — KHAC 401, de bao dung benh', async () => {
  delete process.env.ZALO_INTAKE_SECRET;
  const res = await goiCua(GOI_MAU);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).loi, 'chua-dat-ZALO_INTAKE_SECRET');
  assert.equal(await demBaiCuaNguon(), 0);

  const cauHinh = await GET_CAU_HINH(new Request('http://localhost/api/nhan-bai-zalo/cau-hinh'));
  assert.equal(cauHinh.status, 503, 'ca hai route dung chung mot lop xac thuc');
});

test('401 khi thieu hoac sai khoa, va KHONG lo ly do nao', async () => {
  for (const khoa of [null, '', 'sai-khoa', `${KHOA}x`, KHOA.slice(0, -1)]) {
    const res = await goiCua(GOI_MAU, khoa);
    assert.equal(res.status, 401, String(khoa));
    assert.deepEqual(await res.json(), { loi: 'unauthorized' }, String(khoa));
  }
  // Khoa dung nhung thieu tien to "Bearer " cung khong qua
  const thieuBearer = await POST(new Request('http://localhost/api/nhan-bai-zalo', {
    method: 'POST', headers: { authorization: KHOA }, body: JSON.stringify(GOI_MAU),
  }));
  assert.equal(thieuBearer.status, 401);
  assert.equal(await demBaiCuaNguon(), 0);
});

test('400 khi THIEU TRUONG bat buoc — chan TRUOC khi cham CSDL va kho tep', async () => {
  for (const [nhan, goi] of [
    ['thieu-nguon-id', { ma_tin: 'm', nguyen_van: 'x' }],
    ['thieu-ma-tin', { nguon_id: NGUON, nguyen_van: 'x' }],
    ['thieu-nguyen-van', { nguon_id: NGUON, ma_tin: 'm' }],
  ] as const) {
    const res = await goiCua(goi);
    assert.equal(res.status, 400, nhan);
    assert.equal((await res.json()).loi, nhan);
  }
  assert.equal(await demBaiCuaNguon(), 0);
  assert.equal(daHoiKho.length, 0, 'goi hong khong duoc dung toi kho tep');
});

test('goi QUA NHIEU TEP van vao (201): 10 tep dau duoc nhan, tep du bao ra o tep_bo_qua', async () => {
  // Truoc day ca goi an 400 — ma agent da tai het tep len kho TRUOC do (qua ve),
  // nen moi luot quet lai de thanh mot bo tep mo coi moi ma tin thi khong bao gio
  // vao. Gio no di dung luat "mot tep la khong lam hong ca tin".
  const tep = Array.from({ length: 12 }, (_, i) => {
    const url = `${KHO}/zalo/${NGUON}/2026-09-18/anh-${i + 1}.jpg`;
    tepTrenKho.set(url, 1024);
    return { ten: `anh-${i + 1}.jpg`, loai: 'image/jpeg', kich_thuoc: 1024, url,
             gui_luc: GOI_MAU.dinh_kem[0].gui_luc };
  });

  const res = await goiCua({ ...GOI_MAU, ma_tin: 'tin_nhieu_tep', dinh_kem: tep });
  assert.equal(res.status, 201);
  const than = await res.json();
  assert.ok(than.so_bai_nhap > 0, 'bo me van phai co bai de duyet');
  assert.deepEqual(
    than.tep_bo_qua.map((t: { ten: string; ly_do: string }) => [t.ten, t.ly_do]),
    [['anh-11.jpg', 'qua-nhieu-tep'], ['anh-12.jpg', 'qua-nhieu-tep']]);

  const [dong] = await db.query(`SELECT dinh_kem FROM bai_tu_zalo WHERE ma_tin = 'tin_nhieu_tep'`);
  assert.equal((dong.dinh_kem as unknown[]).length, 10);

  // Va bo me DOC LAI duoc ly do o muc cho duyet
  const [muc] = await zaloStore.listBaiChoDuyet(FAM);
  assert.deepEqual(muc.bai.tepBoQua.map((t) => t.ly_do), ['qua-nhieu-tep', 'qua-nhieu-tep']);
});

test('mot tep .zip cua co KHONG lam hong ca tin: 201, tin vao du, tep do bao ra', async () => {
  const res = await goiCua({
    ...GOI_MAU,
    dinh_kem: [
      GOI_MAU.dinh_kem[0],
      {
        ten: 'worksheet.docx', loai: 'application/zip', kich_thuoc: 4096,
        gui_luc: GOI_MAU.dinh_kem[0].gui_luc,
        url: `${KHO}/zalo/${NGUON}/2026-09-18/worksheet-abc.docx`,
      },
    ],
  });
  assert.equal(res.status, 201, 'mot tep sai loai khoa vinh vien ca tin giao bai');
  const than = await res.json();
  assert.ok(than.so_bai_nhap > 0, 'bo me van phai co bai de duyet');
  assert.deepEqual(than.tep_bo_qua.map((t: { ten: string; ly_do: string }) => [t.ten, t.ly_do]),
    [['worksheet.docx', 'loai-khong-nhan']]);

  // Va bo me DOC LAI duoc o muc cho duyet, khong phai doan vi sao thieu tep
  const [muc] = await zaloStore.listBaiChoDuyet(FAM);
  assert.deepEqual(muc.bai.tepBoQua.map((t) => t.ly_do), ['loai-khong-nhan']);
  assert.equal(muc.bai.dinhKem.length, 1, 'tep hop le van phai vao du');
});

test('tep cua NGUON KHAC / ngoai kho bi bo, tin van vao — url la dau vao tu ben ngoai', async () => {
  const laiTep = [
    { nhan: 'nguon khac', url: `${KHO}/zalo/${NGUON_KHAC}/2026-09-18/video-x.mp4` },
    { nhan: 'ho video con nop', url: `${KHO}/nop-bai/be-na.mp4` },
    { nhan: 'dia chi ngoai', url: 'https://evil.example.com/zalo/nzl_cambridge/2026-09-18/v.mp4' },
  ];
  for (const [i, { nhan, url }] of laiTep.entries()) {
    tepTrenKho.set(url, 1024);
    const res = await goiCua({
      ...GOI_MAU,
      ma_tin: `tin_url_${i}`,
      dinh_kem: [{ ten: `${nhan}.mp4`, loai: 'video/mp4', kich_thuoc: 1024, url,
                   gui_luc: GOI_MAU.dinh_kem[0].gui_luc }],
    });
    assert.equal(res.status, 201, nhan);
    const than = await res.json();
    assert.ok(than.so_bai_nhap > 0, nhan);
    assert.deepEqual(than.tep_bo_qua.map((t: { ly_do: string }) => t.ly_do), ['url-khong-nhan'], nhan);
    const [dong] = await db.query(
      `SELECT dinh_kem FROM bai_tu_zalo WHERE ma_tin = $1`, [`tin_url_${i}`]);
    assert.deepEqual(dong.dinh_kem, [], nhan);
  }
});

test('url dung ho nhung KHO khong co tep -> bo va bao ra, khong ghi mot dinh_kem ma', async () => {
  const url = `${KHO}/zalo/${NGUON}/2026-09-18/chua-tai-len.mp4`;
  const res = await goiCua({
    ...GOI_MAU,
    ma_tin: 'tin_thieu_tep',
    dinh_kem: [{ ten: 'chua-tai-len.mp4', loai: 'video/mp4', kich_thuoc: 1024, url,
                 gui_luc: GOI_MAU.dinh_kem[0].gui_luc }],
  });
  assert.equal(res.status, 201);
  assert.deepEqual((await res.json()).tep_bo_qua.map((t: { ly_do: string }) => t.ly_do),
    ['khong-thay-trong-kho']);
  assert.ok(daHoiKho.includes(url), 'cua nhan phai HOI kho chu khong tin agent');
});

test('so byte lay tu KHO, khong tu con so agent khai', async () => {
  const url = `${KHO}/zalo/${NGUON}/2026-09-18/video-that.mp4`;
  tepTrenKho.set(url, 3_145_728);
  const res = await goiCua({
    ...GOI_MAU,
    ma_tin: 'tin_byte',
    // Agent khai 1KB cho mot tep 3MB — con so nay di vao CSDL nen khong duoc tin
    dinh_kem: [{ ten: 'video-that.mp4', loai: 'video/mp4', kich_thuoc: 1024, url,
                 gui_luc: GOI_MAU.dinh_kem[0].gui_luc }],
  });
  assert.equal(res.status, 201);
  const [dong] = await db.query(`SELECT dinh_kem FROM bai_tu_zalo WHERE ma_tin = 'tin_byte'`);
  const dinhKem = dong.dinh_kem as { bytes: number }[];
  assert.equal(dinhKem.length, 1);
  assert.equal(dinhKem[0].bytes, 3_145_728);
});

test('kho bao tep NANG HON 25MB thi bo, du agent khai vua du', async () => {
  const url = `${KHO}/zalo/${NGUON}/2026-09-18/phim-dai.mp4`;
  tepTrenKho.set(url, 26 * 1024 * 1024);
  const res = await goiCua({
    ...GOI_MAU,
    ma_tin: 'tin_nang',
    dinh_kem: [{ ten: 'phim-dai.mp4', loai: 'video/mp4', kich_thuoc: 1024, url,
                 gui_luc: GOI_MAU.dinh_kem[0].gui_luc }],
  });
  assert.equal(res.status, 201);
  assert.deepEqual((await res.json()).tep_bo_qua.map((t: { ly_do: string }) => t.ly_do), ['qua-nang']);
});

test('kho loi TAM THOI thi GIU tep theo so agent khai — chi BlobNotFoundError moi la "khong co"', async () => {
  const url = `${KHO}/zalo/${NGUON}/2026-09-18/video-ket-mang.mp4`;
  tepTrenKho.set(url, 2_000_000);
  // Kho con song, chi dang chan bot yeu cau. Gop no vao nhanh "khong co tep" la
  // MAT VINH VIEN video cua co: tin van 201 nen dong `bai_tu_zalo` da ghi, va
  // agent gui lai sau 30 phut chi nhan 409.
  khoNemLoi = new BlobServiceRateLimited(5);
  const res = await goiCua({
    ...GOI_MAU,
    ma_tin: 'tin_kho_loi',
    dinh_kem: [{ ten: 'video-ket-mang.mp4', loai: 'video/mp4', kich_thuoc: 1024, url,
                 gui_luc: GOI_MAU.dinh_kem[0].gui_luc }],
  });
  assert.equal(res.status, 201);
  assert.deepEqual((await res.json()).tep_bo_qua, [], 'mot cu rate-limit khong duoc bo tep cua co');
  const [dong] = await db.query(`SELECT dinh_kem FROM bai_tu_zalo WHERE ma_tin = 'tin_kho_loi'`);
  const dinhKem = dong.dinh_kem as { bytes: number }[];
  assert.equal(dinhKem.length, 1);
  assert.equal(dinhKem[0].bytes, 1024, 'lui ve so agent khai (da kep theo tran o docGoiTin)');
});

test('hai tep KHONG TEN bi bo o hai buoc khac nhau van ra hai nhan khac nhau', async () => {
  // Tep tu Zalo hay khong co ten, nen `#N` la thu duy nhat bo me phan biet chung.
  // Dem theo hai khong gian chi so khac nhau (goi THO o `docGoiTin`, mang DA LOC
  // o `nhanTepDaTai`) la ca hai cung ra "#1" — dung thu cai ten do sinh ra de tranh.
  const urlNgoaiKho = `${KHO}/zalo/${NGUON_KHAC}/2026-09-18/video-x.mp4`;
  tepTrenKho.set(urlNgoaiKho, 1024);
  const res = await goiCua({
    ...GOI_MAU,
    ma_tin: 'tin_khong_ten',
    dinh_kem: [
      // Bi bo o `docGoiTin` (sai loai) — vi tri THO 0
      { ten: '', loai: 'application/zip', kich_thuoc: 4096,
        gui_luc: GOI_MAU.dinh_kem[0].gui_luc,
        url: `${KHO}/zalo/${NGUON}/2026-09-18/worksheet.docx` },
      // Qua duoc `docGoiTin`, bi bo o `nhanTepDaTai` (url ho khac) — vi tri THO 1
      { ten: '', loai: 'video/mp4', kich_thuoc: 1024,
        gui_luc: GOI_MAU.dinh_kem[0].gui_luc, url: urlNgoaiKho },
    ],
  });

  assert.equal(res.status, 201);
  assert.deepEqual((await res.json()).tep_bo_qua.map((t: { ten: string; ly_do: string }) => [t.ten, t.ly_do]),
    [['#1', 'loai-khong-nhan'], ['#2', 'url-khong-nhan']]);

  const [muc] = await zaloStore.listBaiChoDuyet(FAM);
  assert.deepEqual(muc.bai.tepBoQua.map((t) => t.ten), ['#1', '#2'],
    'bo me phai phan biet duoc hai tep trong danh sach "khong vao duoc"');
});

test('tep cua KHO BLOB KHAC bi bo voi ly do ngoai-kho — ten mien chung khong phai kho cua minh', async () => {
  const url = `${KHO_LA}/zalo/${NGUON}/2026-09-18/video.mp4`;
  // Dung san tep tren "kho la" de chung minh KHONG phai `head()` chan no: neu
  // chi dua vao `head()` thi loi quyen cua kho la roi vao nhanh "loi tam thoi
  // thi GIU tep" va url do di thang vao `dinh_kem`.
  tepTrenKho.set(url, 1024);
  const res = await goiCua({
    ...GOI_MAU,
    ma_tin: 'tin_kho_la',
    dinh_kem: [{ ten: 'video.mp4', loai: 'video/mp4', kich_thuoc: 1024, url,
                 gui_luc: GOI_MAU.dinh_kem[0].gui_luc }],
  });

  assert.equal(res.status, 201, 'mot url la khong duoc lam hong ca tin');
  const than = await res.json();
  assert.deepEqual(than.tep_bo_qua.map((t: { ly_do: string }) => t.ly_do), ['ngoai-kho']);
  assert.ok(than.so_bai_nhap > 0);
  assert.ok(!daHoiKho.includes(url), 'chan TRUOC khi hoi kho, khong de head() quyet dinh');

  const [dong] = await db.query(`SELECT dinh_kem FROM bai_tu_zalo WHERE ma_tin = 'tin_kho_la'`);
  assert.deepEqual(dong.dinh_kem, [], 'url cua kho nguoi khac khong duoc vao dinh_kem');
});

test('url dung kho MINH + kho loi tam thoi -> van GIU tep (nhanh co chu dinh con nguyen)', async () => {
  const url = `${KHO}/zalo/${NGUON}/2026-09-18/video-cua-minh.mp4`;
  tepTrenKho.set(url, 2_000_000);
  khoNemLoi = new BlobServiceRateLimited(5);
  const res = await goiCua({
    ...GOI_MAU,
    ma_tin: 'tin_kho_minh_loi',
    dinh_kem: [{ ten: 'video-cua-minh.mp4', loai: 'video/mp4', kich_thuoc: 1024, url,
                 gui_luc: GOI_MAU.dinh_kem[0].gui_luc }],
  });
  assert.equal(res.status, 201);
  assert.deepEqual((await res.json()).tep_bo_qua, [], 'phep ghim ma kho khong duoc lam mat nhanh nay');
  const [dong] = await db.query(
    `SELECT dinh_kem FROM bai_tu_zalo WHERE ma_tin = 'tin_kho_minh_loi'`);
  assert.equal((dong.dinh_kem as unknown[]).length, 1);
});

/* ---------------- 5c. Cua so nhan tep ---------------- */

test('cua so nhan tep duoc AP: video mau sau tin 4 GIAY vao, tep nhan xet sau 4 TIENG bi bo', async () => {
  const trongCuaSo = `${KHO}/zalo/${NGUON}/2026-09-18/video-mau.mp4`;
  const ngoaiCuaSo = `${KHO}/zalo/${NGUON}/2026-09-18/nhan-xet-be-khac.mp4`;
  tepTrenKho.set(trongCuaSo, 1024);
  tepTrenKho.set(ngoaiCuaSo, 1024);

  const res = await goiCua({
    ...GOI_MAU,
    ma_tin: 'tin_cua_so',
    dinh_kem: [
      // Ca THAT: video mau cua co toi sau tin 4 giay
      { ten: 'video-mau.mp4', loai: 'video/mp4', kich_thuoc: 1024, url: trongCuaSo,
        gui_luc: '2026-09-18T20:03:21+07:00' },
      // Ca THAT: tep nhan xet tung be toi sau ~4 tieng — dung loai tep ma luat
      // cua captain sinh ra de loai
      { ten: 'nhan-xet-be-khac.mp4', loai: 'video/mp4', kich_thuoc: 1024, url: ngoaiCuaSo,
        gui_luc: '2026-09-19T00:15:00+07:00' },
    ],
  });

  assert.equal(res.status, 201, 'mot tep ngoai cua so khong duoc lam hong ca tin');
  const than = await res.json();
  assert.ok(than.so_bai_nhap > 0, 'bo me van phai co bai de duyet');
  assert.deepEqual(than.tep_bo_qua.map((t: { ten: string; ly_do: string }) => [t.ten, t.ly_do]),
    [['nhan-xet-be-khac.mp4', 'ngoai-cua-so']]);

  const [dong] = await db.query(`SELECT dinh_kem FROM bai_tu_zalo WHERE ma_tin = 'tin_cua_so'`);
  assert.deepEqual((dong.dinh_kem as { url: string }[]).map((t) => t.url), [trongCuaSo]);
  assert.ok(!daHoiKho.includes(ngoaiCuaSo), 'tep da loai thi khong ton them mot luot hoi kho');

  // Va bo me DOC LAI duoc ly do o muc cho duyet
  const [muc] = await zaloStore.listBaiChoDuyet(FAM);
  assert.deepEqual(muc.bai.tepBoQua.map((t) => t.ly_do), ['ngoai-cua-so']);
});

test('cua so nhan tep: tin KHONG co gio gui thi van nhan tep; tep thieu gio gui thi bao rieng', async () => {
  const url = `${KHO}/zalo/${NGUON}/2026-09-18/video-mau.mp4`;
  tepTrenKho.set(url, 1024);
  const tep = { ten: 'video-mau.mp4', loai: 'video/mp4', kich_thuoc: 1024, url };

  // Khong co moc thi khong tinh duoc cua so — dung bien "khong biet" thanh "bo het"
  const khongMoc = await goiCua({
    ...GOI_MAU, ma_tin: 'tin_khong_moc', gui_luc: null,
    dinh_kem: [{ ...tep, gui_luc: '2026-09-19T00:15:00+07:00' }],
  });
  assert.equal(khongMoc.status, 201);
  assert.deepEqual((await khongMoc.json()).tep_bo_qua, []);
  const [dongA] = await db.query(`SELECT dinh_kem FROM bai_tu_zalo WHERE ma_tin = 'tin_khong_moc'`);
  assert.equal((dongA.dinh_kem as unknown[]).length, 1);

  // Tin CO moc ma tep thi khong: khong doi chieu duoc, bao ra bang ly do rieng
  const thieuGio = await goiCua({ ...GOI_MAU, ma_tin: 'tin_thieu_gio', dinh_kem: [tep] });
  assert.equal(thieuGio.status, 201);
  assert.deepEqual((await thieuGio.json()).tep_bo_qua.map((t: { ly_do: string }) => t.ly_do),
    ['thieu-gio-gui']);
});

test('cua phat ve DOI DU hai moc gio — thieu cai nao cung 422, khong ky ve nao', async () => {
  const duongDan = `zalo/${NGUON}/2026-09-18/video-mau.mp4`;
  for (const [nhan, gio] of [
    ['thieu tep_gui_luc', gioVe(GOI_MAU.gui_luc, null)],
    ['thieu tin_gui_luc', gioVe(null, GOI_MAU.dinh_kem[0].gui_luc)],
    ['thieu ca hai', ''],
  ] as const) {
    const res = await xinVe(
      [`nguon_id=${NGUON}&ma_tin=tin_ve_gio`, gio].filter(Boolean).join('&'),
      thanXinVe(duongDan));
    assert.equal(res.status, 422, nhan);
    assert.equal((await res.json()).loi, 'thieu-gio-gui', nhan);
  }
  assert.deepEqual(veDaKy, [], 'khong biet tep co vao duoc khong thi KHONG duoc phat ve');
});

test('BAT BIEN: ve nao duoc ky (200) thi cua nhan tin KHONG bo tep do vi ly do gio', async () => {
  // Hai cua phai tu choi DUNG cung mot tap tep. Lech nhau la tep len kho roi moi
  // bi bo: khong dong `dinh_kem` nao tro toi, tuc khong `han_xoa` va khong luot
  // don nao thu hoi duoc. Nen doi chieu HAI CUA tren CUNG mot bo du lieu, chu
  // khong kiem tung ca roi.
  //
  // `veTin` / `veTep` la thu agent KHAI o query string cua cua ve, khi no khac
  // voi thu nam trong than goi tin. Do dung la ca that cua moc hong: query string
  // di qua `URLSearchParams`, ma no doi '+' cua mui gio thanh khoang trang, con
  // than goi tin la JSON nen khong dinh gi.
  const LY_DO_GIO = ['ngoai-cua-so', 'thieu-gio-gui'];
  const bang: {
    nhan: string; tin: string | null; tep: string | null;
    veTin?: string | null; veTep?: string | null;
  }[] = [
    { nhan: 'trong cua so (video mau sau tin 4 giay)',
      tin: GOI_MAU.gui_luc, tep: '2026-09-18T20:03:21+07:00' },
    { nhan: 'dung giay cuoi cua cua so 90 phut',
      tin: GOI_MAU.gui_luc, tep: '2026-09-18T21:33:17+07:00' },
    { nhan: 'ngoai cua so (tep nhan xet tung be sau ~4 tieng)',
      tin: GOI_MAU.gui_luc, tep: '2026-09-19T00:15:00+07:00' },
    { nhan: 'tep gui TRUOC tin',
      tin: GOI_MAU.gui_luc, tep: '2026-09-18T20:03:16+07:00' },
    { nhan: 'thieu gio cua TEP', tin: GOI_MAU.gui_luc, tep: null },
    { nhan: 'thieu gio cua TIN', tin: null, tep: '2026-09-18T20:03:21+07:00' },
    // Agent quen percent-encode '+': moc toi cua ve thanh '...T20:03:17 07:00',
    // `Date.parse` doc khong ra. Than goi tin van dung, va tep do NGOAI cua so —
    // nen phat ve o day la tep len kho roi moi bi bo, khong thu hoi duoc.
    { nhan: 'moc cua ve hong vi quen percent-encode dau +',
      tin: GOI_MAU.gui_luc, tep: '2026-09-19T00:15:00+07:00',
      veTin: '2026-09-18T20:03:17 07:00', veTep: '2026-09-19T00:15:00 07:00' },
    { nhan: 'moc cua ve la chuoi rac',
      tin: GOI_MAU.gui_luc, tep: '2026-09-19T00:15:00+07:00',
      veTin: 'hom qua', veTep: 'luc nay' },
  ];

  for (const [i, ca] of bang.entries()) {
    const ten = `tep-${i}.mp4`;
    const duongDan = `zalo/${NGUON}/2026-09-18/${ten}`;
    const url = `${KHO}/${duongDan}`;
    tepTrenKho.set(url, 1024);
    veDaKy.length = 0;

    const veTin = ca.veTin === undefined ? ca.tin : ca.veTin;
    const veTep = ca.veTep === undefined ? ca.tep : ca.veTep;
    const ve = await xinVe(
      [`nguon_id=${NGUON}&ma_tin=tin_bat_bien_${i}`, gioVe(veTin, veTep)].filter(Boolean).join('&'),
      thanXinVe(duongDan));

    const nhan = await goiCua({
      ...GOI_MAU, ma_tin: `tin_bat_bien_${i}`, gui_luc: ca.tin,
      dinh_kem: [{ ten, loai: 'video/mp4', kich_thuoc: 1024, url, gui_luc: ca.tep }],
    });
    assert.equal(nhan.status, 201, ca.nhan);
    const boQua = (await nhan.json()).tep_bo_qua as { ten: string; ly_do: string }[];
    const boViGio = boQua.filter((t) => LY_DO_GIO.includes(t.ly_do));

    if (ve.status === 200) {
      assert.deepEqual(veDaKy, [duongDan], ca.nhan);
      assert.deepEqual(boViGio, [], `ve da ky ma cua nhan tin lai bo vi gio: ${ca.nhan}`);
    } else {
      assert.equal(ve.status, 422, ca.nhan);
      assert.ok(LY_DO_GIO.includes((await ve.json()).loi), ca.nhan);
      assert.deepEqual(veDaKy, [], ca.nhan);
    }
  }
});

test('404 khi nguon khong co / dang tat / chua gan con nao', async () => {
  const la = await goiCua({ ...GOI_MAU, nguon_id: 'nzl_khong_co' });
  assert.equal(la.status, 404);
  assert.equal((await la.json()).loi, 'khong-co-nguon');

  const tat = await goiCua({ ...GOI_MAU, nguon_id: NGUON_TAT });
  assert.equal(tat.status, 404);
  assert.equal((await tat.json()).loi, 'nguon-tat');

  await db.query(
    `INSERT INTO nguon_zalo (id, family_id, ten_nhom, ten_co) VALUES ('nzl_trong', $1, 'Lớp trống', 'Cô X')`,
    [FAM]);
  const trong = await goiCua({ ...GOI_MAU, nguon_id: 'nzl_trong' });
  assert.equal(trong.status, 404);
  assert.equal((await trong.json()).loi, 'nguon-chua-co-con');
  await db.query(`DELETE FROM nguon_zalo WHERE id = 'nzl_trong'`);

  assert.equal(await demBaiCuaNguon(), 0);
});

test('201 lan dau, 409 lan hai voi cung ma_tin — va lan hai KHONG tao them gi', async () => {
  const mot = await goiCua(GOI_MAU);
  assert.equal(mot.status, 201);
  const than = await mot.json();
  assert.ok(than.bai_zalo_id);
  assert.ok(than.so_bai_nhap > 0);
  assert.deepEqual(than.con.map((c: { ten: string }) => c.ten), ['Huy Bình', 'Huy An']);

  const soBai = await demBaiCuaNguon();
  const soTin = Number((await db.query(`SELECT COUNT(*) AS n FROM bai_tu_zalo`))[0].n);
  daHoiKho.length = 0;

  const hai = await goiCua(GOI_MAU);
  assert.equal(hai.status, 409);
  assert.equal((await hai.json()).loi, 'trung-ma-tin');
  assert.equal(await demBaiCuaNguon(), soBai, 'lan hai tao them bai');
  assert.equal(Number((await db.query(`SELECT COUNT(*) AS n FROM bai_tu_zalo`))[0].n), soTin);
  assert.equal(daHoiKho.length, 0, 'goi trung van di doi chieu tep');

  // `ma_tin` chi duy nhat TRONG MOT NGUON: cung ma_tin o nguon khac van vao duoc
  const khacNguon = await goiCua({ ...GOI_MAU, nguon_id: NGUON_KHAC });
  assert.equal(khacNguon.status, 201);
});

test('GET cau-hinh tra ve dung dang hop dong, chi nguon DANG BAT', async () => {
  const res = await GET_CAU_HINH(new Request('http://localhost/api/nhan-bai-zalo/cau-hinh', {
    headers: { authorization: `Bearer ${KHOA}` },
  }));
  assert.equal(res.status, 200);
  const { nguon } = await res.json();
  const ids = nguon.map((n: { id: string }) => n.id);
  assert.ok(ids.includes(NGUON));
  assert.ok(!ids.includes(NGUON_TAT), 'nguon dang tat khong duoc gui cho zalo-agent');

  const mot = nguon.find((n: { id: string }) => n.id === NGUON);
  assert.deepEqual(Object.keys(mot).sort(),
    ['con', 'cua_so_dinh_kem_phut', 'id', 'ma_nhom', 'mau_nhan_dien', 'nhom_zalo', 'ten_co'].sort());
  assert.equal(mot.nhom_zalo, 'Cambridge 1.27 - Smart Kids Education');
  assert.deepEqual(mot.mau_nhan_dien, ['bai tap ve nha', 'ngay hoc thu']);
  assert.equal(mot.cua_so_dinh_kem_phut, 90);
  assert.deepEqual(mot.con, [{ id: CON_A, ten: 'Huy Bình' }, { id: CON_B, ten: 'Huy An' }]);

  // Tran cua cua nhan: zalo-agent phai biet TRUOC cai gi se bi bo
  const { gioi_han } = await (await GET_CAU_HINH(
    new Request('http://localhost/api/nhan-bai-zalo/cau-hinh', {
      headers: { authorization: `Bearer ${KHOA}` },
    }))).json();
  assert.deepEqual(gioi_han.loai_tep, ['image/*', 'audio/*', 'video/*', 'application/pdf']);
  assert.equal(gioi_han.toi_da_mb, 25);
  assert.equal(gioi_han.toi_da_tep_moi_goi, 10);
  // CACH dua tep vao cung la hop dong: tep khong di trong than request nua
  assert.equal(gioi_han.cach_tai, 'blob-client-token');
  assert.equal(gioi_han.duong_token, '/api/nhan-bai-zalo/tep-token');
});

test('nguon cua NHA DEMO khong bao gio lot vao cua danh cho may, nhung man bo me van thay', async () => {
  const res = await GET_CAU_HINH(new Request('http://localhost/api/nhan-bai-zalo/cau-hinh', {
    headers: { authorization: `Bearer ${KHOA}` },
  }));
  const { nguon } = await res.json();
  // Nha demo duoc seed lai moi ban build voi DUNG ten nhom cua lop that, ma ten
  // nhom la khoa duy nhat zalo-agent doi chieu duoc: lot vao day thi bai (va tep
  // co mat cac chau) chay vao mot nha ai cung mo duoc bang PIN demo, hoac nha
  // THAT khong bao gio nhan duoc bai.
  assert.ok(!nguon.some((n: { id: string }) => n.id === NGUON_DEMO),
    'nguon cua nha demo lot vao cau hinh cua zalo-agent');
  assert.ok(nguon.some((n: { id: string }) => n.id === NGUON), 'nguon nha that phai con');
  assert.ok(
    !nguon.some((n: { nhom_zalo: string }, i: number, ds: { nhom_zalo: string }[]) =>
      ds.findIndex((x) => x.nhom_zalo === n.nhom_zalo) !== i),
    'hai nguon trung ten nhom thi zalo-agent khong phan biet noi');

  // Man bo me cua nha demo VAN thay nguon mau — captain di demo phai co gi de xem
  const cuaDemo = await zaloStore.listNguonZalo(FAM_DEMO);
  assert.deepEqual(cuaDemo.map((n) => n.id), [NGUON_DEMO]);
});

/* ---------------- 2. Bai nhap vo hinh voi con ---------------- */

test('bai nhap KHONG hien o man cua con, KHONG vao con so tom tat, va con KHONG tick duoc', async () => {
  const homNay = store.todayISO();
  const res = await goiCua(goiHanHomNay());
  assert.equal(res.status, 201);
  const { so_bai_nhap } = await res.json();
  assert.ok(so_bai_nhap > 0);

  // (a) Man cua con: `listAssignments` mac dinh khong thay dong nhap
  const cuaCon = await store.listAssignments(FAM, {
    childId: CON_A, from: homNay, to: homNay, includeChores: true, keCaBaiChuaXongTruocDo: true,
  });
  assert.equal(cuaCon.length, 0, 'bai nhap lot ra man cua con');
  // Chi xin ro moi thay
  const coNhap = await store.listAssignments(FAM, { childId: CON_A, keCaNhap: true, from: '2000-01-01' });
  assert.ok(coNhap.length > 0);
  assert.ok(coNhap.every((a) => a.laNhap && a.zaloBaiId !== null));
  // Va dong nhap do VAN thoa bo loc cua man con — tuc thu duy nhat giu no lai
  // la `CHI_BAI_THAT` o truy van, khong phai mot may man nao cua ngay/trang thai
  assert.ok(coNhap.some((a) => veTrenManCuaCon(a.choreId, a.dueDate, homNay, a.status)));

  // (b) Con so tom tat: hai o "Hoàn thành"/"Đang chờ" va huy hieu chon ten
  const tienDo = await store.progressUpcoming(FAM);
  const cuaA = tienDo.find((r) => r.child.id === CON_A)!;
  assert.equal(cuaA.total, 0, 'bai nhap bi dem vao tien do');
  assert.equal(cuaA.overdue, 0);
  assert.equal(await store.countAssignments(FAM), 0);

  // (c) Duong cua con: `getAssignment` mac dinh tra null nen PATCH 404 ngay
  assert.equal(await store.getAssignment(FAM, coNhap[0].id), null);
  assert.equal((await store.setStatus(FAM, coNhap[0].id, true)), null);
  assert.equal(
    (await db.query(`SELECT status FROM assignments WHERE id = $1`, [coNhap[0].id]))[0].status,
    'todo', 'con tick duoc mot bai nhap');
});

test('dong nhap KHONG chan +10 cua ca ngay — bai de vo nhat cua ca thay doi nay', async () => {
  const homNay = store.todayISO();
  // Mot bai THAT cua hom nay, con lam xong
  await db.query(
    `INSERT INTO assignments (id, child_id, subject, icon, content, due_date, status, completed_at)
     VALUES ('asg_that', $1, 'Toán', '🔢', 'Bài 3 trang 34', $2, 'done', now())`, [CON_A, homNay]);

  // Co giao them bai luc 20h (han roi dung hom nay), bo me chua kip duyet
  const res = await goiCua(goiHanHomNay());
  assert.equal(res.status, 201);
  assert.equal(
    (await store.listAssignments(FAM, { keCaNhap: true, childId: CON_A, date: homNay }))
      .filter((a) => a.laNhap).length > 0,
    true, 'dong nhap phai roi dung vao NGAY dang xet, khong thi bai kiem nay vo nghia');

  const { ngayXong } = await store.congDiemNgayNeuXong(FAM, CON_A, homNay);
  assert.equal(ngayXong, 10, 'mot dong nhap khong ai tick duoc da khoa mat +10 cua ca ngay');
});

/* ---------------- 3. Duyet mot cham ---------------- */

test('duyet mot cham: bai thanh that, hien ngay o man cua con va vao tien do', async () => {
  const homNay = store.todayISO();
  const res = await goiCua(goiHanHomNay());
  const { bai_zalo_id, so_bai_nhap } = await res.json();

  const kq = await zaloStore.duyetBaiZalo(FAM, bai_zalo_id);
  assert.ok(kq.ok, JSON.stringify(kq));
  assert.equal(kq.soBai, so_bai_nhap);

  const cuaCon = await store.listAssignments(FAM, {
    childId: CON_A, from: homNay, to: homNay, includeChores: true, keCaBaiChuaXongTruocDo: true,
  });
  assert.ok(cuaCon.length > 0, 'duyet xong ma con van khong thay bai');
  assert.ok(cuaCon.every((a) => !a.laNhap));
  // Van giu duong lan nguoc ve nguyen van tin de bo me doi chieu sau khi duyet
  assert.ok(cuaCon.every((a) => a.zaloBaiId === bai_zalo_id));

  const tienDo = await store.progressUpcoming(FAM);
  assert.equal(tienDo.find((r) => r.child.id === CON_A)!.total, cuaCon.length);

  // Bam lan hai (bo va me cung bam) -> khong duyet lai
  const lanHai = await zaloStore.duyetBaiZalo(FAM, bai_zalo_id);
  assert.deepEqual(lanHai, { ok: false, loi: 'da-xu-ly' });

  // Nha khac khong duyet duoc tin cua nha nay
  assert.deepEqual(await zaloStore.duyetBaiZalo(FAM_KHAC, bai_zalo_id), { ok: false, loi: 'khong-thay' });
});

test('duyet cho ngay TU HOM NAY TRO DI thi tao dong nhiem vu (hang rao +10); ngay da qua thi khong', async () => {
  await db.query(
    `INSERT INTO daily_chores (id, family_id, content, sort_order) VALUES ('chr_1', $1, 'Cất sách vở vào ba lô', 1)`,
    [FAM]);
  const mai = store.todayISO(1);

  // Han = ngay trong tin + 1 = mai
  const res = await goiCua({ ...GOI_MAU, ngay_trong_tin: store.todayISO(0) });
  const { bai_zalo_id } = await res.json();
  // Truoc khi duyet: chua co dong nhiem vu nao cho ngay mai
  assert.equal(Number((await db.query(
    `SELECT COUNT(*) AS n FROM assignments WHERE chore_id IS NOT NULL AND due_date = $1`, [mai]))[0].n), 0);

  await zaloStore.duyetBaiZalo(FAM, bai_zalo_id);
  assert.equal(Number((await db.query(
    `SELECT COUNT(*) AS n FROM assignments WHERE chore_id IS NOT NULL AND due_date = $1`, [mai]))[0].n), 2,
    'duyet xong ma ngay mai khong co dong nhiem vu -> +10 cua ngay mai cong som duoc');

  // Ngay DA QUA: han bi kep len hom nay (hanNopBai) nen khong bao gio sinh dong
  // nhiem vu cho mot ngay cu — kiem bang chinh cai ngay cu do.
  const cu = store.todayISO(-10);
  const res2 = await goiCua({ ...GOI_MAU, ma_tin: 'tin_cu', ngay_trong_tin: cu });
  const { bai_zalo_id: id2 } = await res2.json();
  await zaloStore.duyetBaiZalo(FAM, id2);
  assert.equal(Number((await db.query(
    `SELECT COUNT(*) AS n FROM assignments WHERE chore_id IS NOT NULL AND due_date = $1`, [cu]))[0].n), 0);
});

/* ---------------- 4. "Khong phai bai" ---------------- */

test('"Không phải bài": xoa bai nhap, GIU dong tin de lan quet sau van bi 409 chan', async () => {
  const res = await goiCua(GOI_MAU);
  const { bai_zalo_id, so_bai_nhap } = await res.json();

  const kq = await zaloStore.boBaiZalo(FAM, bai_zalo_id);
  assert.ok(kq.ok, JSON.stringify(kq));
  assert.equal(kq.soBai, so_bai_nhap);
  assert.equal(await demBaiCuaNguon(), 0);
  assert.equal(
    (await db.query(`SELECT trang_thai FROM bai_tu_zalo WHERE id = $1`, [bai_zalo_id]))[0].trang_thai,
    'bo', 'dong tin phai o lai de chan lan quet sau');

  // zalo-agent quet lai 30 phut sau -> 409, khong dung lai mot muc bo me vua bo
  const lai = await goiCua(GOI_MAU);
  assert.equal(lai.status, 409);
  assert.equal(await demBaiCuaNguon(), 0);

  assert.deepEqual(await zaloStore.boBaiZalo(FAM, bai_zalo_id), { ok: false, loi: 'da-xu-ly' });
  assert.deepEqual(await zaloStore.boBaiZalo(FAM_KHAC, bai_zalo_id), { ok: false, loi: 'khong-thay' });
});

test('muc cho duyet: chi tin dang nhap, kem nguon va bai nhap cua tung con', async () => {
  const res = await goiCua(GOI_MAU);
  const { bai_zalo_id } = await res.json();

  const muc = await zaloStore.listBaiChoDuyet(FAM);
  assert.equal(muc.length, 1);
  assert.equal(muc[0].bai.id, bai_zalo_id);
  assert.equal(muc[0].nguon.id, NGUON);
  assert.equal(muc[0].bai.nguoiGui, 'Thu Huyền');
  assert.equal(muc[0].bai.ngayHocSo, 40);
  assert.equal(muc[0].bai.ngayTrongTin, '2026-09-18');
  assert.ok(muc[0].bai.nguyenVan.includes('Jolly Phonics'));
  assert.equal(await zaloStore.demBaiChoDuyet(FAM), 1);

  // Bai nhap chia deu cho ca hai con cua nguon (moi con mot ban rieng)
  const cuaA = muc[0].baiNhap.filter((b) => b.childId === CON_A);
  const cuaB = muc[0].baiNhap.filter((b) => b.childId === CON_B);
  assert.ok(cuaA.length > 0);
  assert.equal(cuaA.length, cuaB.length);

  // Duyet xong thi muc bien mat khoi danh sach cho duyet
  await zaloStore.duyetBaiZalo(FAM, bai_zalo_id);
  assert.equal((await zaloStore.listBaiChoDuyet(FAM)).length, 0);
  assert.equal(await zaloStore.demBaiChoDuyet(FAM), 0);
});

test('bai nhap giu DUNG THU TU co giao viet, khong bi sap lai theo ten mon', async () => {
  const res = await goiCua(GOI_MAU);
  assert.equal(res.status, 201);

  const bai = await store.listAssignments(FAM, { keCaNhap: true, from: '2000-01-01', childId: CON_A });
  // Bo tach tho cat theo dong, nen dong dau cua tin phai la bai dau tien —
  // ORDER BY mac dinh (due_date, subject, a.id) se day "Phần tiếng anh" (mon
  // Tiếng Anh) len truoc "Phần Jolly Phonics" (mon Khác) va xao tung ca danh sach.
  assert.ok(bai[0].content.startsWith('Cô Huyền thân gửi'), bai[0].content.slice(0, 40));
  const viTri = (chu: string) => bai.findIndex((b) => b.content.includes(chu));
  assert.ok(viTri('Jolly Phonics') < viTri('Phần tiếng anh'), 'thu tu hai phan bi dao');
  assert.ok(viTri('Phần tiếng anh') < viTri('Góc xem phim'), 'thu tu ba khoi bi dao');
  // Va thu tu do la CHINH thu tu bo tach tra ve, ghi vao cot rieng
  const thuTu = await db.query(
    `SELECT zalo_thu_tu FROM assignments WHERE child_id = $1 AND zalo_bai_id IS NOT NULL
      ORDER BY zalo_thu_tu`, [CON_A]);
  assert.deepEqual(thuTu.map((r) => Number(r.zalo_thu_tu)), bai.map((_, i) => i));

  // Bai bo me nhap tay KHONG co thu tu nay (cot NULL) — hanh vi cu khong doi
  await store.saveSubmission({
    familyId: FAM, rawText: null, imageUrls: [], childIds: [CON_A],
    dueDate: store.todayISO(), source: 'primary_school',
    drafts: [{ subject: 'Toán', icon: '🔢', content: 'Bài 1', note: null, lang: 'vi', confidence: 1 }],
  });
  const [tay] = await db.query(
    `SELECT zalo_thu_tu FROM assignments WHERE zalo_bai_id IS NULL AND child_id = $1`, [CON_A]);
  assert.equal(tay.zalo_thu_tu, null);
});

/* ---------------- 5. Tep dinh kem ---------------- */

test('tep cua goi mau duoc nhan va gan vao TUNG bai nhap', async () => {
  const res = await goiCua(GOI_MAU);
  assert.equal(res.status, 201);
  assert.deepEqual((await res.json()).tep_bo_qua, [], 'ca hai video cua goi mau phai vao');

  const bai = await store.listAssignments(FAM, { keCaNhap: true, from: '2000-01-01', childId: CON_A });
  assert.ok(bai.length > 0);
  for (const b of bai) {
    assert.equal(b.media.length, 2, 'con mo bai phai xem duoc video mau cua co');
    assert.ok(b.media.every((m) => m.kind === 'video'));
  }

  // Va ban goc giu du thong tin tep de man duyet ve trinh phat
  const [dong] = await db.query(`SELECT dinh_kem FROM bai_tu_zalo LIMIT 1`);
  const dinhKem = dong.dinh_kem as { kind: string; url: string; han_xoa: string }[];
  assert.equal(dinhKem.length, 2);
  assert.ok(dinhKem.every((t) => t.kind === 'video' && t.url.startsWith('https://')));
  assert.ok(dinhKem.every((t) => t.han_xoa > '2026-09-18'), 'moi tep phai co han xoa');
});

test('khong co tep thi van tao bai binh thuong', async () => {
  const res = await goiCua({ ...GOI_MAU, dinh_kem: [] });
  assert.equal(res.status, 201);
  assert.equal(daHoiKho.length, 0);
  assert.ok((await res.json()).so_bai_nhap > 0);
});

/* ---------------- 5b. Cua phat ve tai tep ---------------- */

test('cua phat ve: 503 chua co khoa, 401 thieu/sai khoa — cung lop xac thuc voi hai cua kia', async () => {
  const duongDan = `zalo/${NGUON}/2026-09-18/video.mp4`;
  const tham = `nguon_id=${NGUON}&ma_tin=tin_ve&${gioVe()}`;

  delete process.env.ZALO_INTAKE_SECRET;
  const chuaCoKhoa = await xinVe(tham, thanXinVe(duongDan));
  assert.equal(chuaCoKhoa.status, 503);
  assert.equal((await chuaCoKhoa.json()).loi, 'chua-dat-ZALO_INTAKE_SECRET');

  process.env.ZALO_INTAKE_SECRET = KHOA;
  for (const khoa of [null, '', 'sai-khoa', `${KHOA}x`]) {
    const res = await xinVe(tham, thanXinVe(duongDan), khoa);
    assert.equal(res.status, 401, String(khoa));
    assert.deepEqual(await res.json(), { loi: 'unauthorized' }, String(khoa));
  }
});

test('cua phat ve CHI ky cho zalo/<nguon>/<ngay>/ — khoa hop le khong ghi sang ho khac', async () => {
  const tham = `nguon_id=${NGUON}&ma_tin=tin_ve&${gioVe()}`;
  for (const duongDan of [
    `zalo/${NGUON_KHAC}/2026-09-18/video.mp4`,
    'nop-bai/be-na.mp4',
    `zalo/${NGUON}/2026-09-18/them/video.mp4`,
    `zalo/${NGUON}/khong-phai-ngay/video.mp4`,
    'video.mp4',
  ]) {
    const res = await xinVe(tham, thanXinVe(duongDan));
    assert.equal(res.status, 400, duongDan);
    // MOT ten truong loi cho ca ba cua danh cho may, ke ca ma do than chung
    // `xuLyTaiTep` sinh: agent doc log bang dung mot khoa.
    assert.deepEqual(await res.json(), { loi: 'sai-duong-dan' }, duongDan);
  }
  assert.deepEqual(veDaKy, [], 'duong dan sai thi KHONG duoc ky ve nao');
});

test('cua phat ve: 404 nguon la, 400 thieu tham so, 409 khi ma_tin DA CO', async () => {
  const duongDan = `zalo/${NGUON}/2026-09-18/video.mp4`;
  assert.equal((await xinVe(`ma_tin=x&${gioVe()}`, thanXinVe(duongDan))).status, 400);
  assert.equal((await xinVe(`nguon_id=${NGUON}&${gioVe()}`, thanXinVe(duongDan))).status, 400);

  const la = await xinVe(`nguon_id=nzl_khong_co&ma_tin=x&${gioVe()}`,
    thanXinVe('zalo/nzl_khong_co/2026-09-18/v.mp4'));
  assert.equal(la.status, 404);
  assert.equal((await la.json()).loi, 'khong-co-nguon');

  // Tin da nhan roi: tra 409 NGAY de agent khoi tai lai ca bo tep cua no
  await goiCua(GOI_MAU);
  const trung = await xinVe(`nguon_id=${NGUON}&ma_tin=${GOI_MAU.ma_tin}&${gioVe()}`,
    thanXinVe(duongDan));
  assert.equal(trung.status, 409);
  assert.equal((await trung.json()).loi, 'trung-ma-tin');
});

test('cua phat ve tu choi DUNG nhung tin ma cua nhan tin se tu choi — nguon tat, nguon chua gan con', async () => {
  // Bo me tat nguon luc 20h trong khi agent dang chay: ve ky duoc o day la hai
  // video cua co nam mai tren kho ma khong dong `dinh_kem` nao tro toi, tuc
  // khong `han_xoa` va khong luot don nao thu hoi duoc.
  const veTat = await xinVe(
    `nguon_id=${NGUON_TAT}&ma_tin=tin_chua_co&${gioVe()}`,
    thanXinVe(`zalo/${NGUON_TAT}/2026-09-18/video.mp4`));
  assert.equal(veTat.status, 404);
  assert.equal((await veTat.json()).loi, 'nguon-tat');
  assert.equal((await goiCua({ ...GOI_MAU, ma_tin: 'tin_chua_co', nguon_id: NGUON_TAT })).status, 404);

  await db.query(
    `INSERT INTO nguon_zalo (id, family_id, ten_nhom, ten_co) VALUES ('nzl_trong', $1, 'Lớp trống', 'Cô X')`,
    [FAM]);
  const veTrong = await xinVe(
    `nguon_id=nzl_trong&ma_tin=tin_chua_co&${gioVe()}`,
    thanXinVe('zalo/nzl_trong/2026-09-18/video.mp4'));
  assert.equal(veTrong.status, 404);
  assert.equal((await veTrong.json()).loi, 'nguon-chua-co-con');
  await db.query(`DELETE FROM nguon_zalo WHERE id = 'nzl_trong'`);

  assert.deepEqual(veDaKy, [], 'khong ve nao duoc ky cho hai nguon do');

  // Nguon con song thi ve VAN duoc ky — cong chung khong chan nham duong that
  const duongDan = `zalo/${NGUON}/2026-09-18/video.mp4`;
  const ok = await xinVe(`nguon_id=${NGUON}&ma_tin=tin_chua_co&${gioVe()}`, thanXinVe(duongDan));
  assert.equal(ok.status, 200);
  assert.deepEqual(veDaKy, [duongDan]);
});

test('cua phat ve KHONG chan su kien "tep da len kho" cua Vercel Blob — no khong mang khoa Bearer', async () => {
  const duongDan = `zalo/${NGUON}/2026-09-18/video-mau-abc123.mp4`;
  const suKien = {
    type: 'blob.upload-completed',
    payload: { blob: { pathname: duongDan, url: `${KHO}/${duongDan}` }, tokenPayload: null },
  };

  // Dung hinh dang may chu cua Vercel Blob goi ve `callbackUrl`: khong khoa
  // Bearer, khong tham so truy van. Mot 401 o day la ve da ky, tep da len kho,
  // roi @vercel/blob bao loi ve cho ben tai — agent coi nhu that bai va gui lai
  // moi 30 phut mai mai.
  const res = await xinVe('', suKien, null);
  assert.equal(res.status, 200);
  assert.deepEqual(suKienHoanTat, [duongDan], 'su kien phai toi duoc handleUpload');

  // Con MOT YEU CAU XIN VE khong khoa thi van 401 — phep kiem khoa chi chuyen
  // cho chu khong bi bo.
  const xinVeKhongKhoa = await xinVe(
    `nguon_id=${NGUON}&ma_tin=tin_chua_co&${gioVe()}`, thanXinVe(duongDan), null);
  assert.equal(xinVeKhongKhoa.status, 401);
  assert.deepEqual(await xinVeKhongKhoa.json(), { loi: 'unauthorized' });
  assert.deepEqual(veDaKy, []);
});

test('goi thieu nguoi_gui / nhom_zalo: luu chuoi RONG, khong lay ten da cau hinh lap vao', async () => {
  // Rang buoc cua captain: nhan dien co chi dua vao TEN HIEN THI, nen trung ten
  // hay doi ten la vo AM THAM. Lay `nguon.tenCo` lap vao cho trong la che dung
  // cai tin hieu ay — man cho duyet phai nhan duoc chuoi rong de noi "khong doc
  // duoc", chu khong nhan mot cai ten nhin nhu that.
  const res = await goiCua({ ...GOI_MAU, ma_tin: 'tin_khuyet_ten', nguoi_gui: '', nhom_zalo: '' });
  assert.equal(res.status, 201);

  const [muc] = await zaloStore.listBaiChoDuyet(FAM);
  assert.equal(muc.bai.nguoiGui, '');
  assert.equal(muc.bai.nhomZalo, '', 'khong duoc dien ten nhom da cau hinh vao day');
  assert.notEqual(muc.bai.nguoiGui, muc.nguon.tenCo);
});

/* ---------------- 5d. Tach bai hong giua chung ---------------- */

test('buoc tach hong GIUA CHUNG: tin van 201, dong o lai, va duoc danh dau de tach lai', async () => {
  saveSubmissionNem = new Error('neon: connection reset');
  const res = await goiCua(GOI_MAU);

  // 500 o day la tin ket VINH VIEN: dong `bai_tu_zalo` da commit nen moi lan
  // zalo-agent quet lai chi nhan 409.
  assert.equal(res.status, 201, 'tin da vao CSDL roi thi khong duoc thoat ra thanh 500');
  const than = await res.json();
  assert.ok(than.bai_zalo_id);
  assert.equal(than.so_bai_nhap, 0);

  const [muc] = await zaloStore.listBaiChoDuyet(FAM);
  assert.equal(muc.bai.trangThaiTach, 'loi');
  assert.match(muc.bai.loiTach ?? '', /connection reset/);
  assert.equal(muc.baiNhap.length, 0);
  assert.equal(muc.bai.nguyenVan, GOI_MAU.nguyen_van, 'nguyen van tin phai con de bo me doc');

  // Va dung la agent khong dua lai duoc — nen "Tách lại" la duong DUY NHAT
  saveSubmissionNem = null;
  assert.equal((await goiCua(GOI_MAU)).status, 409);
});

test('"Tách lại" dung du bai nhap cho MOI con cua nguon, va goi hai lan khong nhan doi', async () => {
  saveSubmissionNem = new Error('neon: connection reset');
  const { bai_zalo_id } = await (await goiCua(GOI_MAU)).json();
  saveSubmissionNem = null;

  const lan1 = await zaloStore.tachLaiBaiZalo(FAM, bai_zalo_id);
  assert.ok(lan1.ok, JSON.stringify(lan1));
  assert.ok(lan1.soBai > 0);
  assert.deepEqual([...new Set(lan1.baiNhap.map((b) => b.childId))].sort(), [CON_B, CON_A].sort());

  const [muc1] = await zaloStore.listBaiChoDuyet(FAM);
  assert.equal(muc1.bai.trangThaiTach, 'xong', 'canh bao phai biet mat sau khi tach lai');
  assert.equal(muc1.bai.loiTach, null);
  assert.equal(muc1.baiNhap.length, lan1.baiNhap.length);

  // Idempotent: xoa-roi-tao-lai, khong cong don
  const lan2 = await zaloStore.tachLaiBaiZalo(FAM, bai_zalo_id);
  assert.ok(lan2.ok, JSON.stringify(lan2));
  assert.equal(lan2.baiNhap.length, lan1.baiNhap.length, 'tach lai hai lan khong duoc nhan doi bai');
  assert.equal((await zaloStore.listBaiChoDuyet(FAM))[0].baiNhap.length, lan1.baiNhap.length);
});

test('"Tách lại" bi tu choi tren tin DA DUYET / DA BO, va bai THAT cua tin da duyet con nguyen', async () => {
  const { bai_zalo_id } = await (await goiCua(GOI_MAU)).json();
  await zaloStore.duyetBaiZalo(FAM, bai_zalo_id);
  const truoc = await store.listAssignments(FAM, { from: '2000-01-01' });
  assert.ok(truoc.length > 0);

  // Tach lai mot tin da duyet la dung lai ban nhap cua nhung bai con DANG LAM
  assert.deepEqual(await zaloStore.tachLaiBaiZalo(FAM, bai_zalo_id), { ok: false, loi: 'da-xu-ly' });
  const sau = await store.listAssignments(FAM, { from: '2000-01-01' });
  assert.deepEqual(sau.map((b) => b.id).sort(), truoc.map((b) => b.id).sort());

  // Tach lai mot tin da bo la dung lai dung thu bo me vua vut di
  const { bai_zalo_id: id2 } = await (await goiCua({ ...GOI_MAU, ma_tin: 'tin_da_bo' })).json();
  await zaloStore.boBaiZalo(FAM, id2);
  assert.deepEqual(await zaloStore.tachLaiBaiZalo(FAM, id2), { ok: false, loi: 'da-xu-ly' });

  // Va nha khac khong voi toi duoc
  assert.deepEqual(
    await zaloStore.tachLaiBaiZalo(FAM_KHAC, bai_zalo_id), { ok: false, loi: 'khong-thay' });
});

/* ---------------- 5e. Kho khong doc ra ma kho ---------------- */

/**
 * `MA_KHO` duoc doc MOT LAN luc nap module, nen ca nay phai chay trong mot TIEN
 * TRINH KHAC voi token sai khuon — cung cach lib/man-con-mui-gio.test.ts doi TZ.
 * Tra ve `{ status, loi }` cua mot yeu cau XIN VE hop le.
 */
function xinVeVoiToken(token: string): { status: number; loi: string } {
  const HOOK = new URL('../scripts/test-hook.mjs', import.meta.url).pathname;
  const url = (x: string) => JSON.stringify(new URL(x, import.meta.url).href);
  const kichBan = `
    process.env.BTVN_PGLITE_DIR = 'memory://';
    delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
    delete process.env.DATABASE_URL_UNPOOLED; delete process.env.POSTGRES_URL_NON_POOLING;
    process.env.BLOB_READ_WRITE_TOKEN = ${JSON.stringify(token)};
    process.env.ZALO_INTAKE_SECRET = 'khoa';
    const { query, queryTx } = await import(${url('./db.ts')});
    const { chayMigrations } = await import(${url('../scripts/db.mjs')});
    await chayMigrations({
      query: (t, p = []) => query(t, p),
      chayGoi: async (cau) => { await queryTx(cau); },
    });
    const { POST } = await import(${url('../app/api/nhan-bai-zalo/tep-token/route.ts')});
    const tham = new URLSearchParams({
      nguon_id: 'nzl_cambridge', ma_tin: 'tin_moi',
      tin_gui_luc: '2026-09-18T20:03:17+07:00', tep_gui_luc: '2026-09-18T20:03:21+07:00',
    });
    const res = await POST(new Request('http://localhost/api/nhan-bai-zalo/tep-token?' + tham, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer khoa' },
      body: JSON.stringify({ type: 'blob.generate-client-token', payload: {
        pathname: 'zalo/nzl_cambridge/2026-09-18/video.mp4',
        callbackUrl: 'http://localhost/api/nhan-bai-zalo/tep-token',
        clientPayload: null, multipart: false,
      } }),
    }));
    const than = await res.json().catch(() => ({}));
    process.stdout.write(JSON.stringify({ status: res.status, loi: than.loi ?? '' }));
    process.exit(0);
  `;
  const out = execFileSync(
    process.execPath,
    ['--import', HOOK, '--input-type=module', '--eval', kichBan],
    { encoding: 'utf8' }
  );
  return JSON.parse(out);
}

test('token co nhung KHONG rut ra ma kho: cua ve TU CHOI KY (501), khong de cua nhan tin bo tep', async () => {
  // Cua nhan tin tu choi MOI url Blob khi khong co ma kho hop le. Neu cua ve van
  // ky thi agent day het tep cua co len kho, cua nhan tin bo sach voi 'ngoai-kho',
  // va dong `bai_tu_zalo` da ghi nen moi lan quet lai an 409: tep nam tren kho
  // mai ma khong `dinh_kem` nao tro toi, tuc khong `han_xoa` va khong luot don
  // nao thu hoi duoc. Hai cua phai tu choi CUNG mot tap.
  for (const token of [
    'vercel_blob_rw_test',                  // thieu phan bi mat
    'vercel_blob_rw_kho_bi-mat-co-gach',    // bi mat co ky tu ngoai [A-Za-z0-9]
    'blob_rw_kho_bimat',                    // khuon khac hoan toan
  ]) {
    assert.deepEqual(xinVeVoiToken(token), { status: 501, loi: 'kho-khong-doc-duoc' }, token);
  }

  // Doi chieu: cung yeu cau do voi token DUNG khuon thi KHONG bi 501 o day nua
  // (no di tiep, va nguon 'nzl_cambridge' khong co trong CSDL rong cua tien trinh
  // con nen dung o 404 — dieu can ghim la no KHONG con dung o hang rao kho).
  assert.deepEqual(xinVeVoiToken('vercel_blob_rw_kho_bimatgia'),
    { status: 404, loi: 'khong-co-nguon' });
});

/* ---------------- 6. Khong nhin sang nha khac ---------------- */

test('nguon_id quyet dinh nha: tin vao nguon nha A khong bao gio tao bai cho con nha B', async () => {
  const res = await goiCua({ ...GOI_MAU, nguon_id: NGUON_KHAC });
  assert.equal(res.status, 201);
  const { con } = await res.json();
  assert.deepEqual(con.map((c: { id: string }) => c.id), [CON_KHAC]);

  const cuaNhaNay = await store.listAssignments(FAM, { keCaNhap: true, from: '2000-01-01' });
  assert.equal(cuaNhaNay.length, 0, 'bai cua nha khac lot sang nha nay');
  assert.equal(await zaloStore.demBaiChoDuyet(FAM), 0);
  assert.equal(await zaloStore.demBaiChoDuyet(FAM_KHAC), 1);
});

/* ---------------- Tach bai: khong bao gio 500 tay khong ---------------- */

test('khong co AI: van luu ban goc va tao bai nhap tho tu splitByRule', async () => {
  const res = await goiCua(GOI_MAU);
  assert.equal(res.status, 201);
  const [dong] = await db.query(`SELECT nguyen_van, ket_qua_tach FROM bai_tu_zalo LIMIT 1`);
  assert.ok(String(dong.nguyen_van).includes('Cô cảm ơn bố mẹ!'), 'ban goc phai giu nguyen xi');
  const tach = dong.ket_qua_tach as { nguon: string; bai: unknown[] };
  assert.equal(tach.nguon, 'rule');
  assert.ok(tach.bai.length > 0);
});

test('tin chi co mot dong ngan (splitByRule khong ra bai nao) van ra MOT bai nhap giu nguyen van', async () => {
  const res = await goiCua({ ...GOI_MAU, ma_tin: 'tin_ngan', nguyen_van: 'ok', dinh_kem: [] });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).so_bai_nhap, 2, 'mot bai cho moi con trong nguon');
  const [dong] = await db.query(
    `SELECT ket_qua_tach FROM bai_tu_zalo WHERE ma_tin = 'tin_ngan'`);
  assert.equal((dong.ket_qua_tach as { nguon: string }).nguon, 'nguyen-van');
  const bai = await store.listAssignments(FAM, { keCaNhap: true, from: '2000-01-01', childId: CON_A });
  assert.equal(bai[0].content, 'ok');
});

/* ---------------- Cau hinh nguon (man bo me) ---------------- */

test('mau nhan dien duoc BO DAU va ha chu thuong luc ghi — zalo-agent so tren chuoi da fold', async () => {
  const n = await zaloStore.createNguonZalo(FAM, {
    tenNhom: 'Lớp mới', tenCo: 'Cô Lan', maNhom: null,
    mauNhanDien: ['Bài Tập Về Nhà', '  NGÀY  HỌC   THỨ ', 'bài tập về nhà'],
    cuaSoDinhKemPhut: 90, childIds: [CON_A],
  });
  assert.deepEqual(n.mauNhanDien, ['bai tap ve nha', 'ngay hoc thu'], 'trung sau khi fold thi bo');
  await db.query(`DELETE FROM nguon_zalo WHERE id = $1`, [n.id]);
});

test('gan con: chi nhan con CUA NHA NAY, va sua nguon cua nha khac khong an', async () => {
  const n = await zaloStore.createNguonZalo(FAM, {
    tenNhom: 'Lớp mới', tenCo: 'Cô Lan', maNhom: null,
    mauNhanDien: [], cuaSoDinhKemPhut: 90, childIds: [CON_A, CON_KHAC],
  });
  assert.deepEqual(n.childIds, [CON_A], 'con nha khac lot vao nguon');

  assert.equal(await zaloStore.getNguonZalo(FAM_KHAC, n.id), null);
  await zaloStore.updateNguonZalo(FAM_KHAC, n.id, { tenNhom: 'Bị đổi trộm', dangBat: false });
  const sau = (await zaloStore.getNguonZalo(FAM, n.id))!;
  assert.equal(sau.tenNhom, 'Lớp mới');
  assert.equal(sau.dangBat, true);
  await db.query(`DELETE FROM nguon_zalo WHERE id = $1`, [n.id]);
});

test('ma_nhom: goi mang ma thi dien vao nguon con trong, va KHONG BAO GIO ghi de', async () => {
  assert.equal((await zaloStore.getNguonZalo(FAM, NGUON))!.maNhom, null);

  const mot = await goiCua({ ...GOI_MAU, ma_nhom: 'g6948518348545773767' });
  assert.equal(mot.status, 201);
  assert.equal((await zaloStore.getNguonZalo(FAM, NGUON))!.maNhom, 'g6948518348545773767');

  // Lan sau agent mo nham nhom / doc ra ma khac: nguon da co ma thi giu nguyen,
  // khong thi moi tin sau do chay sang nham lop ma khong ai thay.
  const hai = await goiCua({ ...GOI_MAU, ma_tin: 'tin_2', ma_nhom: 'g0000000000000000000' });
  assert.equal(hai.status, 201);
  assert.equal((await zaloStore.getNguonZalo(FAM, NGUON))!.maNhom, 'g6948518348545773767');

  // Goi khong mang ma thi khong xoa mat ma dang co
  const ba = await goiCua({ ...GOI_MAU, ma_tin: 'tin_3' });
  assert.equal(ba.status, 201);
  assert.equal((await zaloStore.getNguonZalo(FAM, NGUON))!.maNhom, 'g6948518348545773767');

  await db.query(`UPDATE nguon_zalo SET ma_nhom = NULL WHERE id = $1`, [NGUON]);
});

test('lan nhan gan nhat duoc ghi khi tin vao — nguon chet am tham thi nhin la thay', async () => {
  assert.equal((await zaloStore.getNguonZalo(FAM, NGUON))!.lanNhanGanNhat, null);
  await goiCua(GOI_MAU);
  assert.ok((await zaloStore.getNguonZalo(FAM, NGUON))!.lanNhanGanNhat);
  // Nguon khac khong bi dong vao: bo me nhin mot hang moc la biet nhom NAO chet
  assert.equal((await zaloStore.getNguonZalo(FAM, NGUON_TAT))!.lanNhanGanNhat, null);
});
