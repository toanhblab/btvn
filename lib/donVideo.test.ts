/**
 * Don video con nop qua han — chay THAT tren PGlite trong RAM, qua CHINH
 * lib/donVideo.ts (scripts/test-hook.mjs cho node resolve import khong duoi;
 * BTVN_PGLITE_DIR=memory:// de lib/db.ts khong dung vao ./.data/pg). Kho tep
 * Vercel Blob thi gia lap bang mock.module, cung cach lib/media.test.ts lam.
 *
 * Xoa tep tren kho KHONG lui duoc, nen tep nay ghim HAI thu:
 *
 *   A. LUAT: xoa khi CA HAI dung — qua SO_NGAY_GIU_VIDEO ngay, VA khong nam
 *      trong SO_VIDEO_MOI_NHAT_GIU_LAI video moi nhat CUA CHINH CON DO. Moi
 *      nhanh cua chu "VA" va cua chu "chinh con do" deu co mot bai rieng.
 *   B. CHIN HANG RAO, danh so nhu o dau lib/donVideo.ts va ten bai o day mang
 *      dung so do: 1 chay thu la mac dinh, 2 tran moi luot (MOT tui chung cho ca
 *      phan don not lan phan chon viec moi), 3 danh sach trang host va thu muc,
 *      4 hai dong ho, 5 so cai ghi TRUOC khi pha, 6 cau dao ngat khi kho tu choi
 *      xoa, 7 chan chay trung, 9 loai nha demo. Rieng hang rao 8 (captain bam tay
 *      lan chay that dau tien) la buoc NGUOI nen khong co bai nao o day.
 *
 * Bai dat nhat o day la "so cai ghi truoc khi pha": no khong kiem duoc bang
 * cach nhin ket qua cuoi cung, nen ham del() gia se DOC THANG CSDL ngay tai
 * thoi diem no bi goi va khang dinh URL da duoc go va so cai da co dong.
 */

import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.BTVN_PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
delete process.env.DATABASE_URL_UNPOOLED; delete process.env.POSTGRES_URL_NON_POOLING;

const NGAY = 86_400_000;

/** URL that cua kho: https, host Blob, thu muc nop-bai/. */
const urlKho = (ten: string) => `https://x.public.blob.vercel-storage.com/nop-bai/${ten}.mp4`;

interface GoiDel { urls: string[]; soCaiLucDo: number; urlConTrongBai: string | null }
const daGoiDel: GoiDel[] = [];
/** URL -> so gio tuoi ma kho BAO CAO. Khong co trong bang thi lay theo CSDL. */
const tuoiKhoBao = new Map<string, number>();
/** URL ma kho tra loi loi khi hoi head(). */
const khoLoi = new Set<string>();
/** URL ma kho tra loi loi khi goi del() — mot lo cham vao la ca lo hong. */
const khoLoiXoa = new Set<string>();

const { query, queryTx } = await import('./db.ts');

mock.module('@vercel/blob', {
  namedExports: {
    head: async (url: string) => {
      if (khoLoi.has(url)) throw new Error('BlobNotFoundError');
      const rieng = tuoiKhoBao.get(url);
      const dong = await query<{ t: Date | string }>(
        `SELECT submitted_video_at AS t FROM assignments WHERE submitted_video_url = $1`, [url]
      );
      const tuCsdl = dong[0] ? new Date(dong[0].t as string).getTime() : Date.now();
      return { size: 1_000_000, uploadedAt: new Date(rieng ?? tuCsdl) };
    },
    del: async (urls: string[]) => {
      if (urls.some((u) => khoLoiXoa.has(u))) throw new Error('BlobServiceNotAvailable');
      // Hang rao 5, kiem NGAY TAI THOI DIEM PHA: truoc khi tep bien mat, so cai
      // phai da co dong va URL phai da bi go khoi bai. Doc thang CSDL o day chu
      // khong nhin ket qua cuoi — ket qua cuoi khong phan biet duoc thu tu.
      const so = await query<{ n: number | string }>(
        `SELECT COUNT(*) AS n FROM video_cleanups WHERE url = ANY($1::text[])`, [urls]
      );
      const con = await query<{ id: string }>(
        `SELECT id FROM assignments WHERE submitted_video_url = ANY($1::text[])`, [urls]
      );
      daGoiDel.push({
        urls: [...urls],
        soCaiLucDo: Number(so[0]?.n ?? 0),
        urlConTrongBai: con[0]?.id ?? null,
      });
    },
  },
});

const donVideo = await import('./donVideo.ts');
const { listAssignments, trangThaiDonVideo } = await import('./store.ts');
const { trangThaiVideo } = await import('./types.ts');
const { chayMigrations } = await import('../scripts/db.mjs');

const db = {
  query: (t: string, p: unknown[] = []) => query<Record<string, unknown>>(t, p),
  chayGoi: async (cau: { sql: string; params?: unknown[] }[]) => { await queryTx(cau); },
};

const N_GIU = donVideo.SO_VIDEO_MOI_NHAT_GIU_LAI;
const NGAY_GIU = donVideo.SO_NGAY_GIU_VIDEO;

/** Mot video mau: bai tap co URL video, nop cach day `ngayTruoc` ngay. */
interface Mau { id: string; con: string; ngayTruoc: number; url?: string; source?: string }

const NHA = [
  { id: 'fam_that', con: ['con_a', 'con_b', 'con_c'] },
  // Nha demo: phai bi loai ngay trong cau SELECT.
  { id: 'fam_demo_ja', con: ['con_demo'] },
  // Moc thu cho dau thoat cua LIKE: 'fam_demo_%' KHONG thoat se bat ca id nay
  // (dau gach duoi la ky tu dai dien), va the la mot nha THAT khong bao gio
  // duoc don. Nha nay phai duoc chon binh thuong.
  { id: 'famxdemoy', con: ['con_x'] },
];

const MAU: Mau[] = [
  // con_a: ba cai dau la 3 moi nhat -> giu, ke ca cai 7 ngay. Hai cai sau -> xoa.
  { id: 'a1', con: 'con_a', ngayTruoc: 1 },
  { id: 'a2', con: 'con_a', ngayTruoc: 3 },
  { id: 'a3', con: 'con_a', ngayTruoc: 7 },
  { id: 'a4', con: 'con_a', ngayTruoc: 9 },
  { id: 'a5', con: 'con_a', ngayTruoc: 11 },
  // con_b: TAT CA deu rat cu, nhung ba cai moi nhat cua CHINH no van duoc giu.
  // Neu dem gop ca nha thi ca bon deu nam ngoai top 3 cua nha -> xoa sach.
  { id: 'b1', con: 'con_b', ngayTruoc: 20 },
  { id: 'b2', con: 'con_b', ngayTruoc: 21 },
  { id: 'b3', con: 'con_b', ngayTruoc: 22 },
  { id: 'b4', con: 'con_b', ngayTruoc: 23 },
  // con_c: nam cai deu MOI (duoi 5 ngay). Hai cai cuoi nam ngoai top 3 nhung
  // chua qua han -> giu. Day la nhanh "VA" chu khong phai "HOAC".
  { id: 'c1', con: 'con_c', ngayTruoc: 1 },
  { id: 'c2', con: 'con_c', ngayTruoc: 2 },
  { id: 'c3', con: 'con_c', ngayTruoc: 3 },
  { id: 'c4', con: 'con_c', ngayTruoc: 4 },
  { id: 'c5', con: 'con_c', ngayTruoc: 4.5 },
  // Nha demo: cu, hang 1 nhung nha demo bi loai truoc khi xet gi.
  { id: 'd1', con: 'con_demo', ngayTruoc: 30, url: 'https://example.com/demo/video.mp4' },
  { id: 'd2', con: 'con_demo', ngayTruoc: 31 },
  { id: 'd3', con: 'con_demo', ngayTruoc: 32 },
  { id: 'd4', con: 'con_demo', ngayTruoc: 33 },
  { id: 'd5', con: 'con_demo', ngayTruoc: 34 },
  // Nha 'famxdemoy': bon cai cu, cai thu tu phai bi don.
  { id: 'x1', con: 'con_x', ngayTruoc: 40 },
  { id: 'x2', con: 'con_x', ngayTruoc: 41 },
  { id: 'x3', con: 'con_x', ngayTruoc: 42 },
  { id: 'x4', con: 'con_x', ngayTruoc: 43 },
];

const urlCua = (m: Mau) => m.url ?? urlKho(m.id);

async function dungLaiDuLieu() {
  await query(`DELETE FROM video_cleanups`);
  await query(`DELETE FROM video_cleanup_runs`);
  for (const n of NHA) await query(`DELETE FROM families WHERE id = $1`, [n.id]);

  for (const [i, n] of NHA.entries()) {
    await query(
      `INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ($1, $2, $3, $4)`,
      [n.id, n.id, `slug-${n.id}`, `hash-${i}`]
    );
    for (const c of n.con) {
      await query(
        `INSERT INTO children (id, family_id, name, avatar_url, color) VALUES ($1, $2, $3, '', 'primary')`,
        [c, n.id, c]
      );
    }
  }
  for (const m of MAU) {
    await query(
      `INSERT INTO assignments
         (id, child_id, subject, icon, content, lang, due_date, source, submitted_video_url, submitted_video_at)
       VALUES ($1, $2, 'Toan', '📝', 'noi dung', 'vi', CURRENT_DATE, $3, $4, now() - ($5::numeric * interval '1 day'))`,
      [m.id, m.con, m.source ?? 'primary_school', urlCua(m), m.ngayTruoc]
    );
  }
  daGoiDel.length = 0;
  tuoiKhoBao.clear();
  khoLoi.clear();
  khoLoiXoa.clear();
}

before(async () => {
  await chayMigrations(db);
});

beforeEach(async () => {
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
  await dungLaiDuLieu();
});

/** URL con lai trong assignments sau mot luot. */
async function conLai(): Promise<Set<string>> {
  const r = await query<{ id: string }>(
    `SELECT id FROM assignments WHERE submitted_video_url IS NOT NULL ORDER BY id`
  );
  return new Set(r.map((x) => x.id));
}

/** Tap dong ma CAU CHON tra ve — luat thuan tuy, khong qua hang rao nao khac. */
async function idsDuocChon(max = 100): Promise<string[]> {
  const r = await query<{ id: string }>(donVideo.SQL_CHON_VIDEO_QUA_HAN, [N_GIU, NGAY_GIU, max]);
  return r.map((x) => x.id).sort();
}

/* ------------------------------ A. LUAT ------------------------------ */

/**
 * Bai nay ghim luat o NGAY CAU SQL, khong qua duong chay day du — co ly do.
 *
 * Ban dau chi co cac bai chay day du ben duoi, va chung KHONG bat duoc loi khi
 * bo dieu kien ngay ra khoi cau chon (tuc bien "VA" thanh "HOAC"): c4/c5 van
 * duoc giu, nhung la nho HANG RAO 4 (kho bao tep con moi) chu khong phai nho
 * luat. Hai hang rao che cho nhau thi mat ca hai cung mot luc la khong ai biet.
 * Nen luat phai co mot bai kiem no MOT MINH.
 */
test('cau chon: dung bon dong, khong hon khong kem', async () => {
  assert.deepEqual(await idsDuocChon(), ['a4', 'a5', 'b4', 'x4']);
});

test('cau chon: bo dieu kien ngay thi c4/c5 lot vao — day la cho phan biet VA voi HOAC', async () => {
  const chon = await idsDuocChon();
  assert.ok(!chon.includes('c4') && !chon.includes('c5'),
    'c4/c5 ngoai top 3 nhung chua qua han: chi dieu kien NGAY moi giu chung lai');
  assert.ok(!chon.includes('a3'),
    'a3 qua han nhung trong top 3: chi dieu kien THU HANG moi giu no lai');
});

test('luat: giu 3 video moi nhat CUA MOI CON, xoa cai thu 4 tro di da qua han', async () => {
  const ra = await donVideo.donVideoQuaHan({ that: true });
  assert.equal(ra.loi, null);

  const con = await conLai();
  // con_a: a3 da 7 ngay (qua han) nhung la cai moi thu 3 -> GIU.
  assert.ok(con.has('a3'), 'video qua han nhung nam trong 3 cai moi nhat thi khong duoc xoa');
  assert.ok(con.has('a1') && con.has('a2'));
  // a4, a5 vua qua han vua ngoai top 3 -> XOA.
  assert.ok(!con.has('a4') && !con.has('a5'), 'video qua han va ngoai 3 cai moi nhat phai bi xoa');
});

test('luat: dem theo TUNG CON, khong gop ca nha', async () => {
  await donVideo.donVideoQuaHan({ that: true });
  const con = await conLai();

  // con_b cu hon con_a rat nhieu (20-23 ngay). Neu xep hang gop ca nha thi ca
  // bon deu nam ngoai top 3 cua nha va bi xoa sach; xep theo tung con thi ba
  // cai moi nhat cua chinh no van con.
  assert.ok(con.has('b1') && con.has('b2') && con.has('b3'),
    '3 video moi nhat cua con_b phai con, du chung cu hon moi video cua con_a');
  assert.ok(!con.has('b4'), 'cai thu 4 cua con_b phai bi xoa');
});

test('luat: hai dieu kien la VA — video moi thi khong xoa du nam ngoai 3 cai moi nhat', async () => {
  await donVideo.donVideoQuaHan({ that: true });
  const con = await conLai();

  // con_c co 5 video nhung deu duoi 5 ngay: c4, c5 hang 4-5 ma chua qua han.
  assert.ok(con.has('c4') && con.has('c5'),
    'ngoai top 3 nhung chua qua han thi phai giu — neu mat la dieu kien dang la HOAC');
  assert.ok(con.has('c1') && con.has('c2') && con.has('c3'));
});

test('luat: con moi nop duoi 3 video thi khong bao gio bi don', async () => {
  await query(`DELETE FROM assignments WHERE id IN ('a4','a5')`);
  await query(`UPDATE assignments SET submitted_video_at = now() - interval '90 days' WHERE child_id = 'con_a'`);

  const ra = await donVideo.donVideoQuaHan({ that: true });
  const con = await conLai();
  assert.ok(con.has('a1') && con.has('a2') && con.has('a3'),
    'ba video du cu 90 ngay van la 3 cai moi nhat cua con do');
  assert.ok(!ra.ungVien.some((m) => m.childId === 'con_a'));
});

/* --------------------------- B. HANG RAO --------------------------- */

test('hang rao 1: chay thu la mac dinh — khong xoa gi, khong ghi so cai', async () => {
  const truoc = await conLai();
  const ra = await donVideo.donVideoQuaHan();

  assert.equal(ra.cheDo, 'thu');
  assert.ok(ra.ungVien.length > 0, 'chay thu van phai liet ke duoc viec se lam');
  assert.deepEqual(ra.daXoa, []);
  assert.equal(daGoiDel.length, 0, 'chay thu KHONG duoc goi del()');
  assert.deepEqual(await conLai(), truoc, 'chay thu khong duoc dong vao assignments');

  const so = await query<{ n: number | string }>(`SELECT COUNT(*) AS n FROM video_cleanups`);
  assert.equal(Number(so[0].n), 0, 'chay thu khong duoc ghi so cai');
});

test('hang rao 2: tran so tep moi luot, va khong nang len qua mac dinh duoc', async () => {
  const ra = await donVideo.donVideoQuaHan({ that: true, max: 2 });
  assert.equal(ra.ungVien.length, 2);
  assert.equal(ra.daXoa.length, 2);

  const xin = await donVideo.donVideoQuaHan({ that: false, max: 9999 });
  assert.ok(xin.ungVien.length <= donVideo.MAX_MOI_LUOT_MAC_DINH);
});

test('hang rao 3: danh sach trang — URL ngoai kho khong bao gio di vao del()', async () => {
  // Dung URL cua che do dev (/api/tep/...) cho mot dong vua qua han vua ngoai top 3.
  await query(`UPDATE assignments SET submitted_video_url = $1 WHERE id = 'a5'`,
    ['/api/tep/0123456789abcdef0123456789abcdef.mp4']);

  const ra = await donVideo.donVideoQuaHan({ that: true });
  const moiUrlDaXoa = daGoiDel.flatMap((g) => g.urls);

  assert.ok(!moiUrlDaXoa.some((u) => u.includes('/api/tep/')));
  assert.ok(ra.boSot.some((b) => b.assignmentId === 'a5' && b.vi === 'khong-phai-video-con-nop-tren-kho'));
  assert.ok((await conLai()).has('a5'), 'URL truot danh sach trang thi de nguyen ca trong CSDL');
});

test('hang rao 3: moi URL da goi del() deu qua duoc laUrlVideoConNop', async () => {
  await donVideo.donVideoQuaHan({ that: true });
  const moiUrl = daGoiDel.flatMap((g) => g.urls);
  assert.ok(moiUrl.length > 0);
  for (const u of moiUrl) assert.ok(donVideo.laUrlVideoConNop(u), `del() nhan URL khong hop le: ${u}`);
});

test('hang rao 4: kho bao tep con moi thi bo qua, du CSDL noi da qua han', async () => {
  tuoiKhoBao.set(urlKho('a4'), Date.now() - 1 * NGAY);

  const ra = await donVideo.donVideoQuaHan({ that: true });
  assert.ok(ra.boSot.some((b) => b.assignmentId === 'a4' && b.vi === 'kho-bao-tep-con-moi'));
  assert.ok((await conLai()).has('a4'), 'hai dong ho lech thi giu lai, khong xoa');
  assert.ok(!(await conLai()).has('a5'), 'dong khac van don binh thuong');
});

test('hang rao 4: hoi kho khong duoc thi bo qua chu khong doan', async () => {
  khoLoi.add(urlKho('a4'));
  const ra = await donVideo.donVideoQuaHan({ that: true });
  assert.ok(ra.boSot.some((b) => b.assignmentId === 'a4' && b.vi === 'khong-hoi-duoc-kho'));
  assert.ok((await conLai()).has('a4'));
});

test('hang rao 5: so cai da co dong VA URL da go TRUOC khi del() chay', async () => {
  await donVideo.donVideoQuaHan({ that: true });

  assert.ok(daGoiDel.length > 0);
  for (const g of daGoiDel) {
    assert.equal(g.soCaiLucDo, g.urls.length,
      'del() chay khi so cai chua ghi du — mat duong dan neu luot chay dut o day');
    assert.equal(g.urlConTrongBai, null,
      'del() chay khi URL van con trong assignments — man hinh se co trinh phat den');
  }

  // Va sau khi xong thi so cai duoc dong dau da xoa.
  const so = await query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM video_cleanups WHERE deleted_at IS NOT NULL`
  );
  assert.equal(Number(so[0].n), 4, 'a4, a5, b4, x4');
});

test('hang rao 5: so cai giu lai duong dan da mat — ban sao duy nhat con lai', async () => {
  await donVideo.donVideoQuaHan({ that: true });
  const so = await query<{ url: string; assignment_id: string; child_id: string }>(
    `SELECT url, assignment_id, child_id FROM video_cleanups ORDER BY assignment_id`
  );
  assert.deepEqual(so.map((r) => r.assignment_id), ['a4', 'a5', 'b4', 'x4']);
  assert.equal(so[0].url, urlKho('a4'));
  assert.equal(so[0].child_id, 'con_a');
});

test('hang rao 7: hai luot xoa that trong cung mot ngay — luot sau bi chan', async () => {
  const mot = await donVideo.donVideoQuaHan({ that: true });
  assert.equal(mot.boQua, undefined);

  const hai = await donVideo.donVideoQuaHan({ that: true });
  assert.equal(hai.boQua, 'da-chay-hom-nay');
  assert.deepEqual(hai.daXoa, []);
  assert.equal(daGoiDel.length, 1, 'luot bi chan khong duoc goi del() them lan nao');
});

test('hang rao 7: chay thu khong bi chan, va khong chiem cho cua luot that', async () => {
  await donVideo.donVideoQuaHan();
  await donVideo.donVideoQuaHan();
  const that = await donVideo.donVideoQuaHan({ that: true });
  assert.equal(that.boQua, undefined, 'chay thu bao nhieu lan cung duoc va khong chan luot that');
  assert.ok(that.daXoa.length > 0);
});

test('hang rao 9: ba nha demo khong bao gio bi dong toi', async () => {
  await donVideo.donVideoQuaHan({ that: true });
  const con = await conLai();
  for (const id of ['d1', 'd2', 'd3', 'd4', 'd5']) {
    assert.ok(con.has(id), `video cua nha demo bi don: ${id}`);
  }
  const moiUrl = daGoiDel.flatMap((g) => g.urls);
  assert.ok(!moiUrl.some((u) => u.includes('example.com')));
});

test('hang rao 9: dau gach duoi cua LIKE duoc thoat — nha that ten gan giong demo van duoc don', async () => {
  const ra = await donVideo.donVideoQuaHan({ that: true });
  assert.ok(ra.daXoa.includes('x4'),
    "'fam_demo_%' khong thoat se bat ca 'famxdemoy' va bo qua mot nha THAT mai mai");
});

test('xoa that ma khong co token kho tep thi dung lai, khong dong vao CSDL', async () => {
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const truoc = await conLai();

  const ra = await donVideo.donVideoQuaHan({ that: true });
  assert.equal(ra.boQua, 'chua-bat-kho-tep');
  assert.equal(ra.runId, null, 'khong duoc chiem cho cua ngay khi chang lam gi');
  assert.deepEqual(await conLai(), truoc);
  assert.equal(daGoiDel.length, 0);
});

test('chay thu khong co token: van liet ke, nhung noi ro chua kiem dong ho thu hai', async () => {
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const ra = await donVideo.donVideoQuaHan();
  assert.ok(ra.ungVien.length > 0);
  assert.ok(ra.ungVien.every((m) => m.bytes === null));
  assert.deepEqual(ra.canhBao, ['chua-kiem-dong-ho-thu-hai'],
    'canh bao cua ca luot, bao MOT lan — khong phai hang rao chan tung dong');
  assert.deepEqual(ra.boSot, [], 'khong dong nao bi CHAN vi thieu token');
});

test('con quay lai dung luc don: URL doi thi khong go, khong xoa tep moi', async () => {
  // Gia lap cuoc dua bang cach doi URL sau khi da chon nhung truoc khi go:
  // cach de nhat la doi URL cua a4 sang mot URL kho khac roi chay lai — dieu
  // kien `submitted_video_url = $4` cua SQL_GO_VA_GHI_SO la thu chan viec nay.
  const ra = await donVideo.donVideoQuaHan({ that: false });
  const a4 = ra.ungVien.find((m) => m.assignmentId === 'a4');
  assert.ok(a4);

  await query(`UPDATE assignments SET submitted_video_url = $1 WHERE id = 'a4'`, [urlKho('a4-quay-lai')]);
  const daGo = await query<{ id: string }>(donVideo.SQL_GO_VA_GHI_SO,
    ['vcl_thu', 'vcr_thu', 'a4', a4.url, null, a4.submittedVideoAt]);

  assert.equal(daGo.length, 0, 'URL da doi thi cau go khong duoc dong vao dong nao');
  const con = await query<{ u: string }>(`SELECT submitted_video_url AS u FROM assignments WHERE id = 'a4'`);
  assert.equal(con[0].u, urlKho('a4-quay-lai'), 'video con vua quay lai phai con nguyen');
});

test('tran cua luot dem SAU hang rao: dong bi chan khong an mat suat xoa', async () => {
  // x4 la dong CU NHAT trong so duoc chon nen cau chon luon dua no len dau. Cho
  // kho luon bao loi khi hoi ve no => no bi hang rao 4 chan VINH VIEN. Neu tran
  // `max` nam o LIMIT cua cau chon thi luot nao cung chi thay mot minh x4, khong
  // bao gio xoa duoc gi, ma van bao "thanh cong, 0 tep" — kho cu the day len.
  khoLoi.add(urlKho('x4'));

  const ra = await donVideo.donVideoQuaHan({ that: true, max: 1 });

  assert.ok(ra.boSot.some((b) => b.assignmentId === 'x4' && b.vi === 'khong-hoi-duoc-kho'));
  assert.deepEqual(ra.daXoa, ['b4'], 'phai xoa duoc dong ke tiep, khong dung lai o dong bi chan');
  assert.equal(ra.ungVien.length, 1, 'tran cua luot van la 1 tep');
  assert.ok((await conLai()).has('x4'), 'dong bi chan van con nguyen');
});

test('tran cua luot van la tran: quet rong hon khong lam xoa nhieu hon', async () => {
  const ra = await donVideo.donVideoQuaHan({ that: true, max: 2 });
  assert.equal(ra.daXoa.length, 2);
  assert.ok(ra.canhBao.includes('dung-o-tran-moi-luot'));
  const so = await query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM video_cleanups WHERE deleted_at IS NOT NULL`
  );
  assert.equal(Number(so[0].n), 2);
});

test('del() hong: URL da go nen tep thanh mo coi — so cai giu no lai va luot sau don not', async () => {
  khoLoiXoa.add(urlKho('a4'));

  const hong = await donVideo.donVideoQuaHan({ that: true });
  assert.ok(hong.loi, 'del() hong phai duoc bao ra chu khong nuot');
  assert.deepEqual(hong.daXoa, [], 'ca lo hong thi khong dong nao duoc dong dau da xoa');
  assert.ok(!(await conLai()).has('a4'), 'URL da bi go truoc khi del() chay — tep thanh mo coi');

  const conSo = await query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM video_cleanups WHERE deleted_at IS NULL`
  );
  assert.equal(Number(conSo[0].n), 4, 'so cai la ban ghi duy nhat con lai cua tep mo coi');

  // Hom sau: kho lanh lai, luot moi khong con thay chung qua assignments nua.
  await query(`UPDATE video_cleanup_runs SET run_date = run_date - 1`);
  khoLoiXoa.clear();

  const sau = await donVideo.donVideoQuaHan({ that: true });
  assert.equal(sau.loi, null);
  assert.deepEqual(sau.daXoaLai.sort(), ['a4', 'a5', 'b4', 'x4'],
    'luot sau phai don not so cai con so, khong thi tep nam lai tren kho mai mai');

  const chuaXoa = await query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM video_cleanups WHERE deleted_at IS NULL`
  );
  assert.equal(Number(chuaXoa[0].n), 0);
  const urlDaXoa = daGoiDel.flatMap((g) => g.urls);
  assert.ok(urlDaXoa.includes(urlKho('a4')));
});

/** So URL trong assignments van con — dem xem luot co go them URL nao khong. */
async function soUrlConLai(): Promise<number> {
  const r = await query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM assignments WHERE submitted_video_url IS NOT NULL`
  );
  return Number(r[0].n);
}

/** Day luot da chay lui mot ngay de luot sau khong bi chi muc UNIQUE chan. */
const luiMotNgay = () => query(`UPDATE video_cleanup_runs SET run_date = run_date - 1`);

test('tran cua luot la MOT tui chung: don not so cai an truoc, viec moi an cho con lai', async () => {
  // Dem 1: hai dong bi go URL roi del() hong => hai tep mo coi (x4 cu nhat, roi b4).
  khoLoiXoa.add(urlKho('x4'));
  khoLoiXoa.add(urlKho('b4'));
  await donVideo.donVideoQuaHan({ that: true, max: 2 });
  await luiMotNgay();
  khoLoiXoa.clear();
  daGoiDel.length = 0;
  const conTruocDem2 = await soUrlConLai();

  // Dem 2: tran van la 2. Don not an het ca hai suat, nen a4/a5 phai doi den mai.
  const sau = await donVideo.donVideoQuaHan({ that: true, max: 2 });

  const soTepDaXoa = daGoiDel.flatMap((g) => g.urls).length;
  assert.equal(soTepDaXoa, 2, 'ca luot khong duoc pha qua tran, du no di qua hai chang');
  assert.deepEqual(sau.daXoaLai.sort(), ['b4', 'x4']);
  assert.deepEqual(sau.daXoa, [], 'het tran o chang don not thi khong duoc chon them viec moi');
  assert.equal(await soUrlConLai(), conTruocDem2, 'khong duoc go them URL nao khi da het tran');
  assert.ok(sau.canhBao.includes('het-tran-o-luot-don-not'));
});

test('cau dao ngat: kho dang tu choi xoa thi khong duoc go them URL nao', async () => {
  khoLoiXoa.add(urlKho('x4'));
  khoLoiXoa.add(urlKho('b4'));
  await donVideo.donVideoQuaHan({ that: true, max: 2 });
  await luiMotNgay();
  const conTruocDem2 = await soUrlConLai();
  const soCaiTruocDem2 = await query<{ n: number | string }>(`SELECT COUNT(*) AS n FROM video_cleanups`);
  daGoiDel.length = 0;

  // Dem 2: kho van hong. a4/a5 van du dieu kien xoa, nhung dung vao chung luc nay
  // la bien mot dong ton bi chan thanh mot dong ton lon dan.
  const sau = await donVideo.donVideoQuaHan({ that: true, max: 2 });

  assert.ok(sau.loi, 'kho hong phai duoc bao ra');
  assert.ok(sau.canhBao.includes('dung-vi-kho-dang-tu-choi-xoa'));
  assert.deepEqual(sau.ungVien, [], 'dung ca luot thi khong duoc chon viec moi');
  assert.equal(await soUrlConLai(), conTruocDem2, 'khong duoc go them URL nao khi kho dang hong');
  const soCaiSau = await query<{ n: number | string }>(`SELECT COUNT(*) AS n FROM video_cleanups`);
  assert.equal(Number(soCaiSau[0].n), Number(soCaiTruocDem2[0].n),
    'khong duoc ghi them dong so cai nao');
});

test('luot don not: so tep va so byte deu tinh ca phan lay lai duoc', async () => {
  khoLoiXoa.add(urlKho('a4'));
  await donVideo.donVideoQuaHan({ that: true });
  await luiMotNgay();
  khoLoiXoa.clear();

  const sau = await donVideo.donVideoQuaHan({ that: true });
  assert.equal(sau.daXoaLai.length, 4);
  assert.equal(sau.soBytes, 4 * 1_000_000, 'so byte phai gom ca tep lay lai tu so cai');

  const luot = await query<{ so_tep: number | string; so_bytes: number | string }>(
    `SELECT so_tep, so_bytes FROM video_cleanup_runs WHERE id = $1`, [sau.runId]
  );
  assert.equal(Number(luot[0].so_tep), 4);
  assert.equal(Number(luot[0].so_bytes), 4 * 1_000_000,
    'so tep va so bytes cua mot luot phai noi ve cung mot tap tep');
});

test('chay that: so byte la so THAT SU mat, khong tinh dong thua cuoc dua', async () => {
  const ra = await donVideo.donVideoQuaHan({ that: true, max: 1 });
  assert.equal(ra.daXoa.length, 1);
  assert.equal(ra.soBytes, 1_000_000);
});

test('chay thu chi bao so cai con so, khong dong vao no', async () => {
  khoLoiXoa.add(urlKho('a4'));
  await donVideo.donVideoQuaHan({ that: true });
  daGoiDel.length = 0;
  khoLoiXoa.clear();

  const thu = await donVideo.donVideoQuaHan();
  assert.ok(thu.canhBao.includes('so-cai-con-4-dong-chua-xoa'));
  assert.deepEqual(thu.daXoaLai, []);
  assert.equal(daGoiDel.length, 0, 'chay thu KHONG duoc goi del()');
});

test('bai da don giu lai moc nop: man cua bo me phan biet duoc voi bai chua quay', async () => {
  await donVideo.donVideoQuaHan({ that: true });

  const a4 = await query<{ u: string | null; t: Date | string | null }>(
    `SELECT submitted_video_url AS u, submitted_video_at AS t FROM assignments WHERE id = 'a4'`
  );
  assert.equal(a4[0].u, null, 'URL phai bi go, khong thi bo me bam vao mot lien ket chet');
  assert.ok(a4[0].t, 'moc nop phai con: no la dau vet duy nhat rang bai nay TUNG co video');

  // Va dong da don khong bao gio duoc chon lai.
  assert.ok(!(await idsDuocChon()).includes('a4'));
});

test('sau khi don, bai do doc ra la "da don" chu khong phai "chua quay"', async () => {
  // Day la con so ma ca ba man cua bo me dung: the 🎥 o man chi tiet con, danh
  // sach "Nop bai cho co", va o dem "{done}/{total} video da quay". Doc moi
  // submittedVideoUrl la bao bo me rang con chua tung quay bai da nop tuan truoc.
  await donVideo.donVideoQuaHan({ that: true });

  const bai = await listAssignments('fam_that', { childId: 'con_a' });
  const daDon = bai.find((a) => a.id === 'a4');
  const conNguyen = bai.find((a) => a.id === 'a1');
  assert.ok(daDon && conNguyen);

  assert.equal(trangThaiVideo(daDon), 'da-don');
  assert.equal(trangThaiVideo(conNguyen), 'da-nop');
  assert.equal(
    bai.filter((a) => trangThaiVideo(a) !== 'chua-quay').length, 5,
    'ca nam bai con_a deu da quay video — don tep di khong lam bai nao thanh chua quay'
  );
});

test('bai chua bao gio co video moi la "chua quay"', async () => {
  await query(
    `INSERT INTO assignments (id, child_id, subject, icon, content, lang, due_date, source)
     VALUES ('a-chua', 'con_a', 'Toan', '📝', 'chua quay', 'vi', CURRENT_DATE, 'primary_school')`
  );
  const bai = await listAssignments('fam_that', { childId: 'con_a' });
  const chua = bai.find((a) => a.id === 'a-chua');
  assert.equal(trangThaiVideo(chua!), 'chua-quay');
});

/* ----------------------- laUrlVideoConNop ----------------------- */

test('laUrlVideoConNop: chi nhan https + host Blob + thu muc nop-bai/', () => {
  const { laUrlVideoConNop: ok } = donVideo;
  assert.equal(ok('https://x.public.blob.vercel-storage.com/nop-bai/quay-1.mp4'), true);
  assert.equal(ok('https://x.public.blob.vercel-storage.com/nop-bai/quay-1.webm'), true);

  // Sai thu muc: tep bo me dinh kem va anh de bai nam o day, khong duoc dong toi.
  assert.equal(ok('https://x.public.blob.vercel-storage.com/dinh-kem/co-doc-mau.mp4'), false);
  assert.equal(ok('https://x.public.blob.vercel-storage.com/bai-tap/anh.jpg'), false);
  // Lach ra ngoai thu muc.
  assert.equal(ok('https://x.public.blob.vercel-storage.com/nop-bai/a/b.mp4'), false);
  assert.equal(ok('https://x.public.blob.vercel-storage.com/nop-bai/'), false);
  // Sai host — ke ca host co chua ten kho lam tien to.
  assert.equal(ok('https://blob.vercel-storage.com.ke-gian.vn/nop-bai/a.mp4'), false);
  assert.equal(ok('https://example.com/demo/video.mp4'), false);
  assert.equal(ok('https://drive.google.com/file/d/abc/view'), false);
  // Sai giao thuc / khong phai URL.
  assert.equal(ok('http://x.public.blob.vercel-storage.com/nop-bai/a.mp4'), false);
  assert.equal(ok('/api/tep/0123456789abcdef0123456789abcdef.mp4'), false);
  assert.equal(ok('data:image/svg+xml;charset=utf-8,%3Csvg%3E'), false);
  assert.equal(ok(''), false);
  assert.equal(ok(null), false);
  assert.equal(ok(`https://x.public.blob.vercel-storage.com/nop-bai/${'a'.repeat(3000)}.mp4`), false);
});

/* ------------- Dong trang thai o man Cai dat cua bo me ------------- */

test('Cai dat: mot lan chay thu ve sau khong che mat luot xoa that', async () => {
  await donVideo.donVideoQuaHan({ that: true });
  // Bo me go `node scripts/don-video.mjs` de xem truoc => mot dong 'thu' MOI HON.
  await donVideo.donVideoQuaHan();

  const lan = await trangThaiDonVideo('fam_that');
  assert.equal(lan.moiNhat?.cheDo, 'thu', 'luot moi nhat la lan xem truoc vua chay');
  assert.equal(lan.donThatGanNhat?.cheDo, 'that',
    'lan xoa that phai van doc duoc, khong thi bo me tuong viec don chua bao gio chay');
  assert.equal(lan.donThatGanNhat?.soCuaNha, 3, 'a4, a5, b4 — x4 la video cua nha khac');
  assert.equal(lan.donThatGanNhat?.coLoi, false);
});

test('Cai dat: tat xoa that roi thi khong duoc khoe mai lan don thang truoc', async () => {
  // Da tung xoa that...
  await donVideo.donVideoQuaHan({ that: true });
  // ...roi DON_VIDEO_CHAY_THAT bi go khoi may chu: tu do dem nao cron cung chi
  // chay thu va khong xoa gi. Man Cai dat phai noi dung tinh trang HIEN GIO.
  for (let i = 0; i < 3; i++) await donVideo.donVideoQuaHan();

  const lan = await trangThaiDonVideo('fam_that');
  assert.equal(lan.moiNhat?.cheDo, 'thu',
    'luot moi nhat dang la chay thu — dong dau tien phai noi dieu do');
  assert.ok(lan.donThatGanNhat, 'va lan xoa that cu van con doc duoc o dong thu hai');
});

test('Cai dat: luot chet giua chung khong duoc bao la da don xong', async () => {
  await donVideo.donVideoQuaHan({ that: true });
  // Route bi cat giua chung: cau ket luot khong chay, nen `loi` van NULL.
  await query(`UPDATE video_cleanup_runs SET finished_at = NULL, loi = NULL WHERE che_do = 'that'`);

  const lan = await trangThaiDonVideo('fam_that');
  assert.equal(lan.moiNhat?.chuaXong, true, 'khong co finished_at thi luot do chua chay xong');
  assert.equal(lan.moiNhat?.coLoi, false);
});

test('Cai dat: chua co luot that nao thi chi co mot dong, la luot chay thu', async () => {
  await donVideo.donVideoQuaHan();
  const lan = await trangThaiDonVideo('fam_that');
  assert.equal(lan.moiNhat?.cheDo, 'thu');
  assert.equal(lan.moiNhat?.soCuaNha, 0);
  assert.equal(lan.donThatGanNhat, null);
});

test('Cai dat: dem theo luot DA XOA, khong theo luot da dinh xoa', async () => {
  // Dem 1: go URL xong thi del() hong => bon dong so cai nam lai, ba trong so do
  // la video cua fam_that.
  khoLoiXoa.add(urlKho('a4'));
  await donVideo.donVideoQuaHan({ that: true });
  await luiMotNgay();
  khoLoiXoa.clear();

  // Dem 2 don not ca bon. Dem theo run_id thi dem nay bao "0 video cua nha minh"
  // dung vao dem ma ba video cua nha do vua that su bi xoa.
  const sau = await donVideo.donVideoQuaHan({ that: true });
  assert.equal(sau.daXoaLai.length, 4);

  const lan = await trangThaiDonVideo('fam_that');
  assert.equal(lan.moiNhat?.cheDo, 'that');
  assert.equal(lan.moiNhat?.soCuaNha, 3, 'a4, a5, b4 — x4 la video cua nha khac');
  assert.equal(lan.moiNhat?.coLoi, false);
  assert.equal(lan.donThatGanNhat, null, 'luot moi nhat CHINH la luot that — khong in hai dong');
});

test('hai hang so cua luat nam dung mot cho va la so captain chot', () => {
  assert.equal(NGAY_GIU, 5);
  assert.equal(N_GIU, 3);
});
