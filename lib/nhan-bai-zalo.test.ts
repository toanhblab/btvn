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
 *   5. TEP. Len kho dung thu muc `zalo/<nguon>/<ngay>/`, gan vao tung bai nhap,
 *      va tep sai loai / qua nang bi chan o 400 truoc khi cham CSDL.
 *   6. KHONG NHIN SANG NHA KHAC. `nguon_id` la thu quyet dinh nha, nen mot
 *      nguon cua nha A khong bao gio tao duoc bai cho con nha B.
 */

import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.BTVN_PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
delete process.env.DATABASE_URL_UNPOOLED; delete process.env.POSTGRES_URL_NON_POOLING;
delete process.env.NOUS_API_KEY;            // ep duong lui splitByRule, ket qua on dinh
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';

/** Moi lan `put` duoc goi — de kiem thu muc va noi dung tep da luu. */
const daPut: { duongDan: string; bytes: number; contentType?: string }[] = [];
mock.module('@vercel/blob', {
  namedExports: {
    put: async (duongDan: string, noiDung: Buffer, opts: { contentType?: string }) => {
      daPut.push({ duongDan, bytes: noiDung.byteLength, contentType: opts?.contentType });
      return { url: `https://kho.public.blob.vercel-storage.com/${duongDan}-abc123` };
    },
    del: async () => {},
    head: async () => null,
  },
});

const { chayMigrations } = await import('../scripts/db.mjs');
const { query, queryTx } = await import('./db.ts');
const store = await import('./store.ts');
const zaloStore = await import('./nhanBaiZalo.ts');
const { veTrenManCuaCon } = await import('./nhomNhiemVu.ts');
const { GOI_MAU } = await import('./zalo.test.ts');
const { POST } = await import('../app/api/nhan-bai-zalo/route.ts');
const { GET: GET_CAU_HINH } = await import('../app/api/nhan-bai-zalo/cau-hinh/route.ts');

const KHOA = 'khoa-dev-gia';
const FAM = 'fam_zalo';
const FAM_KHAC = 'fam_khac';
const CON_A = 'con_binh';
const CON_B = 'con_an';
const CON_KHAC = 'con_nha_khac';
const NGUON = 'nzl_cambridge';
const NGUON_TAT = 'nzl_tat';
const NGUON_KHAC = 'nzl_nha_khac';

const db = {
  query: (t: string, p: unknown[] = []) => query<Record<string, unknown>>(t, p),
  chayGoi: async (cau: { sql: string; params?: unknown[] }[]) => { await queryTx(cau); },
};

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
  ]) {
    await db.query(
      `INSERT INTO families (id, name, slug, parent_pin_hash, score_since)
       VALUES ($1,$2,$3,$4, CURRENT_DATE - 30)`, [fam, ten, slug, pin]);
  }
  for (const [id, fam, ten, mau, thuTu] of [
    [CON_A, FAM, 'Huy Bình', 'primary', 1],
    [CON_B, FAM, 'Huy An', 'secondary', 2],
    [CON_KHAC, FAM_KHAC, 'Bé Na', 'primary', 1],
  ] as const) {
    await db.query(
      `INSERT INTO children (id, family_id, name, avatar_url, color, grade, sort_order)
       VALUES ($1,$2,$3,'/img/x.jpg',$4,'Lớp 1',$5)`, [id, fam, ten, mau, thuTu]);
  }
  for (const [id, fam, ten, bat] of [
    [NGUON, FAM, 'Cambridge 1.27 - Smart Kids Education', true],
    [NGUON_TAT, FAM, 'Lớp đã nghỉ', false],
    [NGUON_KHAC, FAM_KHAC, 'Lớp nhà khác', true],
  ] as const) {
    await db.query(
      `INSERT INTO nguon_zalo (id, family_id, ten_nhom, ten_co, dang_bat)
       VALUES ($1,$2,$3,'Thu Huyền',$4)`, [id, fam, ten, bat]);
  }
  for (const [nguon, con] of [
    [NGUON, CON_A], [NGUON, CON_B], [NGUON_TAT, CON_A], [NGUON_KHAC, CON_KHAC],
  ]) {
    await db.query(`INSERT INTO nguon_zalo_con (nguon_id, child_id) VALUES ($1,$2)`, [nguon, con]);
  }
});

beforeEach(async () => {
  daPut.length = 0;
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

test('400 khi goi hong — tep sai loai / qua nang bi chan TRUOC khi cham CSDL', async () => {
  const saiLoai = await goiCua({
    ...GOI_MAU,
    dinh_kem: [{ ten: 'x.zip', loai: 'application/zip', noi_dung_base64: 'AAAA' }],
  });
  assert.equal(saiLoai.status, 400);
  assert.equal((await saiLoai.json()).loi, 'tep-sai-loai');

  const thieu = await goiCua({ ma_tin: 'm', nguyen_van: 'x' });
  assert.equal(thieu.status, 400);
  assert.equal((await thieu.json()).loi, 'thieu-nguon-id');

  assert.equal(await demBaiCuaNguon(), 0);
  assert.equal(daPut.length, 0, 'goi hong khong duoc dung toi kho tep');
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
  const soPut = daPut.length;

  const hai = await goiCua(GOI_MAU);
  assert.equal(hai.status, 409);
  assert.equal((await hai.json()).loi, 'trung-ma-tin');
  assert.equal(await demBaiCuaNguon(), soBai, 'lan hai tao them bai');
  assert.equal(Number((await db.query(`SELECT COUNT(*) AS n FROM bai_tu_zalo`))[0].n), soTin);
  // Tep VAN duoc tai len truoc khi biet trung (chap nhan: no re hon mot vong
  // SELECT tren moi goi that, va tep mo coi khong tro toi dau). Dieu phai giu
  // la KHONG co dong CSDL nao moi.
  assert.ok(daPut.length >= soPut);

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

test('tep len kho dung thu muc zalo/<nguon>/<ngay>/, va gan vao TUNG bai nhap', async () => {
  const res = await goiCua(GOI_MAU);
  assert.equal(res.status, 201);

  assert.equal(daPut.length, 2, 'hai video cua goi mau');
  for (const p of daPut) {
    assert.ok(p.duongDan.startsWith('zalo/nzl_cambridge/2026-09-18/'), p.duongDan);
    assert.ok(!p.duongDan.includes('nop-bai/'), 'khong duoc dam vao ho tep cua video con nop');
    assert.equal(p.contentType, 'video/mp4');
    assert.ok(p.bytes > 0);
  }

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
  assert.equal(daPut.length, 0);
  assert.ok((await res.json()).so_bai_nhap > 0);
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

test('lan nhan gan nhat duoc ghi khi tin vao — nguon chet am tham thi nhin la thay', async () => {
  assert.equal((await zaloStore.getNguonZalo(FAM, NGUON))!.lanNhanGanNhat, null);
  await goiCua(GOI_MAU);
  assert.ok((await zaloStore.getNguonZalo(FAM, NGUON))!.lanNhanGanNhat);
  // Nguon khac khong bi dong vao: bo me nhin mot hang moc la biet nhom NAO chet
  assert.equal((await zaloStore.getNguonZalo(FAM, NGUON_TAT))!.lanNhanGanNhat, null);
});
