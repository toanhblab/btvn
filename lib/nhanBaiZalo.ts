/**
 * Cua nhan bai co giao dang tren nhom Zalo — phan cham CSDL va kho tep.
 *
 * Luoc do + ly do tung bang o `migrations/021_nhan_bai_tu_zalo.sql`; phan thuan
 * (doc goi tin, luat han nop, luat tep) o `lib/zalo.ts`; hop dong HTTP o
 * `app/api/nhan-bai-zalo/*`.
 *
 * BA dieu de vap, ghi o day vi khong nhin thay tu mot ham le nao:
 *
 * 1. `nguon_id` la thu QUYET DINH NHA. Cua nhan khong co cookie (zalo-agent goi
 *    bang khoa bi mat, khong phai trinh duyet), nen familyId phai suy ra TU
 *    nguon — va moi cau ghi sau do deu di qua `saveSubmission`, von tu loc lai
 *    childIds theo nha. Mot nguon_id sai khong the tao bai cho nha khac.
 *
 * 2. KHONG BAO GIO 500 TAY KHONG. Tin cua co da nam trong `bai_tu_zalo` truoc
 *    khi goi bo tach bai, nen bo tach hong (AI het quota, mang loi, tra JSON
 *    la) van con ban goc de bo me doc va con it nhat mot bai nhap tho de sua.
 *    Chuoi gap nhat o day la: 409 truoc, luu sau, tach sau cung — nguoc lai la
 *    goi lai lan hai se tao them mot ban nua.
 *
 * 3. Tep len Blob TRUOC khi ghi dong `bai_tu_zalo`, va tep nao hong thi BO QUA
 *    chu khong lam hong ca goi: mot video khong tai duoc khong duoc phep lam
 *    mat ca tin giao bai. Duong nguoc lai (ghi dong roi moi tai) de lai mot
 *    dong `dinh_kem` tro toi tep khong ton tai.
 */

import { put } from '@vercel/blob';
import { query, queryOne } from './db';
import {
  listAssignments, newId, saveSubmission, taoNhiemVuNgayNeuChuaQua, todayISO,
} from './store';
import { extractAssignments, hasAI, inferSource, splitByRule } from './ai';
import { iconFor, type Assignment, type AttachedMedia, type DraftAssignment } from './types';
import { boDau, duongDanTep } from './media';
import { taoT, type T } from './i18n/chu';
import { ngonNguOf, type NgonNgu } from './i18n/ngonNgu';
import {
  baiNhapTho, docNhanDien, duongDanBlobZalo, hanNopBai, loaiTepZalo, tenTepZalo,
  SO_NGAY_GIU_TEP_ZALO, congNgay,
  type GoiTinZalo, type NhanDienZalo, type TepZaloDaLuu,
} from './zalo';

const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/* ---------------- Nguon Zalo (cau hinh) ---------------- */

export interface NguonZalo {
  id: string;
  familyId: string;
  tenNhom: string;
  maNhom: string | null;
  tenCo: string;
  /** Chuoi KHONG DAU zalo-agent doi chieu voi tin (no tu fold dau truoc khi so). */
  mauNhanDien: string[];
  cuaSoDinhKemPhut: number;
  dangBat: boolean;
  lanNhanGanNhat: string | null;
  /** Id cac con duoc gan voi nguon nay — tap RONG la "chua gan con nao". */
  childIds: string[];
}

/** Ten nhom / ten co dai hon thi tran the tren man dien thoai cua bo me. */
export const MAX_CHU_TEN_NHOM = 80;
export const MAX_CHU_TEN_CO = 40;
/** So mau nhan dien toi da — nhieu hon thi khong con la "mau", ma la mot bo loc. */
export const MAX_MAU_NHAN_DIEN = 8;
export const MAU_NHAN_DIEN_MAC_DINH = ['bai tap ve nha', 'ngay hoc thu'];
export const CUA_SO_DINH_KEM_MAC_DINH = 90;
export const MAX_CUA_SO_DINH_KEM_PHUT = 1440;

interface NguonRow {
  id: string; family_id: string; ten_nhom: string; ma_nhom: string | null; ten_co: string;
  mau_nhan_dien: unknown; cua_so_dinh_kem_phut: number | string; dang_bat: boolean;
  lan_nhan_gan_nhat: string | Date | null;
  child_ids: string[] | null;
}

const NGUON_SELECT = `n.id, n.family_id, n.ten_nhom, n.ma_nhom, n.ten_co, n.mau_nhan_dien,
       n.cua_so_dinh_kem_phut, n.dang_bat, n.lan_nhan_gan_nhat,
       ARRAY(SELECT nc.child_id FROM nguon_zalo_con nc
              JOIN children ch ON ch.id = nc.child_id
             WHERE nc.nguon_id = n.id
             ORDER BY ch.sort_order, ch.id) AS child_ids`;

const toNguon = (r: NguonRow): NguonZalo => ({
  id: r.id,
  familyId: r.family_id,
  tenNhom: r.ten_nhom,
  maNhom: r.ma_nhom,
  tenCo: r.ten_co,
  mauNhanDien: docMauNhanDien(r.mau_nhan_dien),
  cuaSoDinhKemPhut: Number(r.cua_so_dinh_kem_phut),
  dangBat: Boolean(r.dang_bat),
  lanNhanGanNhat: r.lan_nhan_gan_nhat ? new Date(r.lan_nhan_gan_nhat).toISOString() : null,
  childIds: r.child_ids ?? [],
});

/**
 * Lam sach danh sach mau nhan dien (tu CSDL hoac tu than request). Bo dau va ha
 * chu thuong ngay o day: zalo-agent so sanh tren chuoi da fold, nen mot mau go
 * co dau se KHONG BAO GIO khop ma khong bao gi — chuan hoa mot lan o cho ghi
 * thi ca hai ben cung doc mot thu.
 */
export function docMauNhanDien(v: unknown): string[] {
  const tho = Array.isArray(v) ? v : [];
  const ra: string[] = [];
  for (const x of tho) {
    if (typeof x !== 'string') continue;
    const sach = boDau(x).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
    if (sach && !ra.includes(sach)) ra.push(sach);
    if (ra.length >= MAX_MAU_NHAN_DIEN) break;
  }
  return ra;
}

/** Cua so dinh kem bo me nhap: so nguyen 1..1440; hong -> null (route bao loi). */
export function lamSachCuaSo(v: unknown): number | null {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > MAX_CUA_SO_DINH_KEM_PHUT) return null;
  return n;
}

export async function listNguonZalo(familyId: string): Promise<NguonZalo[]> {
  const rows = await query<NguonRow>(
    `SELECT ${NGUON_SELECT} FROM nguon_zalo n WHERE n.family_id = $1
      ORDER BY n.created_at ASC, n.id ASC`,
    [familyId]
  );
  return rows.map(toNguon);
}

/** Tra null neu nguon thuoc nha khac — dung lam luon lop kiem tra so huu. */
export async function getNguonZalo(familyId: string, id: string): Promise<NguonZalo | null> {
  const r = await queryOne<NguonRow>(
    `SELECT ${NGUON_SELECT} FROM nguon_zalo n WHERE n.id = $1 AND n.family_id = $2`,
    [id, familyId]
  );
  return r ? toNguon(r) : null;
}

/**
 * Nguon theo id, KHONG kem familyId — chi cho duong cua nhan bai, noi
 * `nguon_id` la thu quyet dinh nha (xem chu thich dau tep). Moi duong cua NGUOI
 * phai di qua `getNguonZalo`.
 */
export async function getNguonZaloChoCuaNhan(id: string): Promise<NguonZalo | null> {
  const r = await queryOne<NguonRow>(`SELECT ${NGUON_SELECT} FROM nguon_zalo n WHERE n.id = $1`, [id]);
  return r ? toNguon(r) : null;
}

/** Con cua nguon, da loc lai theo nha — tap rong neu bo me chua gan con nao. */
async function ganCon(nguonId: string, familyId: string, childIds: string[]): Promise<void> {
  await query(`DELETE FROM nguon_zalo_con WHERE nguon_id = $1`, [nguonId]);
  if (childIds.length === 0) return;
  await query(
    `INSERT INTO nguon_zalo_con (nguon_id, child_id)
     SELECT $1, c.id FROM children c WHERE c.family_id = $2 AND c.id = ANY($3::text[])
     ON CONFLICT DO NOTHING`,
    [nguonId, familyId, childIds]
  );
}

export async function createNguonZalo(
  familyId: string,
  input: {
    tenNhom: string; maNhom: string | null; tenCo: string;
    mauNhanDien: string[]; cuaSoDinhKemPhut: number; childIds: string[];
  }
): Promise<NguonZalo> {
  const id = newId('nzl');
  await query(
    `INSERT INTO nguon_zalo (id, family_id, ten_nhom, ma_nhom, ten_co, mau_nhan_dien,
                             cua_so_dinh_kem_phut)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [id, familyId, input.tenNhom, input.maNhom, input.tenCo,
     JSON.stringify(input.mauNhanDien), input.cuaSoDinhKemPhut]
  );
  await ganCon(id, familyId, input.childIds);
  return (await getNguonZalo(familyId, id))!;
}

export async function updateNguonZalo(
  familyId: string,
  id: string,
  patch: Partial<Pick<NguonZalo, 'tenNhom' | 'maNhom' | 'tenCo' | 'mauNhanDien'
    | 'cuaSoDinhKemPhut' | 'dangBat' | 'childIds'>>
): Promise<NguonZalo | null> {
  const map: Record<string, string> = {
    tenNhom: 'ten_nhom', maNhom: 'ma_nhom', tenCo: 'ten_co',
    cuaSoDinhKemPhut: 'cua_so_dinh_kem_phut', dangBat: 'dang_bat',
  };
  const sets: string[] = [];
  const params: unknown[] = [id, familyId];
  for (const [k, col] of Object.entries(map)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v !== undefined) { params.push(v); sets.push(`${col} = $${params.length}`); }
  }
  if (patch.mauNhanDien !== undefined) {
    params.push(JSON.stringify(patch.mauNhanDien));
    sets.push(`mau_nhan_dien = $${params.length}::jsonb`);
  }
  if (sets.length) {
    await query(
      `UPDATE nguon_zalo SET ${sets.join(', ')} WHERE id = $1 AND family_id = $2`,
      params
    );
  }
  if (patch.childIds !== undefined) {
    // Kiem so huu truoc: khong duoc gan con vao nguon cua nha khac.
    const own = await queryOne<{ id: string }>(
      `SELECT id FROM nguon_zalo WHERE id = $1 AND family_id = $2`, [id, familyId]);
    if (own) await ganCon(id, familyId, patch.childIds);
  }
  return getNguonZalo(familyId, id);
}

/* ---------------- Tin da nhan ---------------- */

export type TrangThaiBaiZalo = 'nhap' | 'da_duyet' | 'bo';

export interface BaiTuZalo {
  id: string;
  nguonId: string;
  maTin: string;
  guiLuc: string | null;
  nguoiGui: string;
  nhomZalo: string;
  ngayHocSo: number | null;
  ngayTrongTin: string | null;
  nguyenVan: string;
  dinhKem: TepZaloDaLuu[];
  nhanDien: NhanDienZalo | null;
  trangThai: TrangThaiBaiZalo;
  createdAt: string;
}

/** Mot muc o man "Bài cô vừa giao, chờ duyệt": tin + nguon + cac bai nhap. */
export interface MucChoDuyet {
  bai: BaiTuZalo;
  nguon: NguonZalo;
  baiNhap: Assignment[];
}

interface BaiRow {
  id: string; nguon_id: string; ma_tin: string; gui_luc: string | Date | null;
  nguoi_gui: string; nhom_zalo: string; ngay_hoc_so: number | string | null;
  ngay_trong_tin: string | Date | null; nguyen_van: string;
  dinh_kem: unknown; nhan_dien: unknown; trang_thai: string;
  created_at: string | Date;
}

const toBai = (r: BaiRow): BaiTuZalo => ({
  id: r.id,
  nguonId: r.nguon_id,
  maTin: r.ma_tin,
  guiLuc: r.gui_luc ? new Date(r.gui_luc).toISOString() : null,
  nguoiGui: r.nguoi_gui,
  nhomZalo: r.nhom_zalo,
  ngayHocSo: r.ngay_hoc_so === null ? null : Number(r.ngay_hoc_so),
  // Cung ly do voi `dateStr` cua lib/store.ts: PGlite tra DATE thanh Date nua
  // dem UTC, doc bang getDate() se lui mot ngay o mui gio am.
  ngayTrongTin: r.ngay_trong_tin
    ? (r.ngay_trong_tin instanceof Date
        ? r.ngay_trong_tin.toISOString().slice(0, 10)
        : String(r.ngay_trong_tin).slice(0, 10))
    : null,
  nguyenVan: r.nguyen_van,
  dinhKem: Array.isArray(r.dinh_kem) ? (r.dinh_kem as TepZaloDaLuu[]) : [],
  nhanDien: docNhanDien(r.nhan_dien),
  trangThai: r.trang_thai as TrangThaiBaiZalo,
  createdAt: new Date(r.created_at).toISOString(),
});

const BAI_COLS = `b.id, b.nguon_id, b.ma_tin, b.gui_luc, b.nguoi_gui, b.nhom_zalo,
       b.ngay_hoc_so, b.ngay_trong_tin, b.nguyen_van, b.dinh_kem, b.nhan_dien,
       b.trang_thai, b.created_at`;

/** Tra null neu tin thuoc nha khac — lop kiem tra so huu cua man duyet. */
export async function getBaiTuZalo(familyId: string, id: string): Promise<BaiTuZalo | null> {
  const r = await queryOne<BaiRow>(
    `SELECT ${BAI_COLS} FROM bai_tu_zalo b
       JOIN nguon_zalo n ON n.id = b.nguon_id
      WHERE b.id = $1 AND n.family_id = $2`,
    [id, familyId]
  );
  return r ? toBai(r) : null;
}

export async function demBaiChoDuyet(familyId: string): Promise<number> {
  const r = await queryOne<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM bai_tu_zalo b
       JOIN nguon_zalo n ON n.id = b.nguon_id
      WHERE n.family_id = $1 AND b.trang_thai = 'nhap'`,
    [familyId]
  );
  return Number(r?.n ?? 0);
}

/**
 * Cac tin dang cho duyet, MOI NHAT TRUOC, kem nguon va cac bai nhap cua tung
 * tin. Bai nhap doc bang CHINH `listAssignments` (co `keCaNhap`) chu khong bang
 * mot cau SQL rieng — de man duyet va man bai tap cua bo me hien cung mot thu
 * cho cung mot dong.
 */
export async function listBaiChoDuyet(familyId: string): Promise<MucChoDuyet[]> {
  const rows = await query<BaiRow>(
    `SELECT ${BAI_COLS} FROM bai_tu_zalo b
       JOIN nguon_zalo n ON n.id = b.nguon_id
      WHERE n.family_id = $1 AND b.trang_thai = 'nhap'
      ORDER BY COALESCE(b.gui_luc, b.created_at) DESC, b.id DESC`,
    [familyId]
  );
  if (rows.length === 0) return [];

  const nguon = new Map((await listNguonZalo(familyId)).map((n) => [n.id, n]));
  const muc: MucChoDuyet[] = [];
  for (const r of rows) {
    const n = nguon.get(r.nguon_id);
    if (!n) continue;
    muc.push({
      bai: toBai(r),
      nguon: n,
      baiNhap: await listAssignments(familyId, { keCaNhap: true, zaloBaiId: r.id, includeChores: true }),
    });
  }
  return muc;
}

/* ---------------- Cua nhan: luu mot tin ---------------- */

export type KetQuaNhanTin =
  | { ok: true; baiZaloId: string; soBaiNhap: number; con: { id: string; ten: string }[] }
  | { ok: false; loi: 'khong-co-nguon' | 'nguon-tat' | 'trung-ma-tin' | 'nguon-chua-co-con' };

/**
 * Ghi mot tep vao `.data/uploads` va tra ve `/api/tep/<ten>` — duong lui khi
 * dev chua bat Vercel Blob, CUNG khuon voi che do 2 cua lib/upload-route.ts.
 *
 * Ten phai la `<32 hex><duoi>`: do la HOP DONG voi hai ben doc no
 * (`TEN_TEP_RE` trong lib/media.ts va `GET /api/tep`), khong phai mot lua chon
 * o day. Doi lai, `.data/uploads` khong ai don nen tep o day song mai — chap
 * nhan, day la DB dev.
 */
async function ghiTepCucBo(noiDung: Buffer, ten: string): Promise<string> {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { extname, join } = await import('node:path');
  const dir = './.data/uploads';
  mkdirSync(dir, { recursive: true });
  const duoi = /^\.[a-z0-9]{1,5}$/i.test(extname(ten)) ? extname(ten).toLowerCase() : '.bin';
  const tenTep = `${crypto.randomUUID().replace(/-/g, '')}${duoi}`;
  writeFileSync(join(dir, tenTep), noiDung);
  return duongDanTep(tenTep);
}

/**
 * Tai cac tep cua goi len kho tep. Tep hong thi BO QUA (xem chu thich dau tep).
 *
 * Ba che do, y het hai route tai tep da co (lib/upload-route.ts):
 *   - Co Vercel Blob        -> len Blob, thu muc `zalo/<nguon>/<ngay>/`.
 *   - Dev chua bat Blob     -> ghi `.data/uploads`, URL `/api/tep/<ten>`. Nho
 *     the ma kiem tay tren may that xem/nghe duoc video mau cua co, khong phai
 *     nhin mot the tep rong.
 *   - TREN VERCEL ma chua bat Blob -> BO QUA va bao ra: dia serverless chi doc,
 *     ghi vao dau cung mat sau request.
 *
 * KHONG bao gio nhet base64 vao CSDL nhu anh de bai (/api/upload): mot video
 * 2MB thanh ~2,7MB base64 trong mot cot jsonb ma man bo me doc lai moi lan mo.
 */
async function taiTepLenKho(
  goi: GoiTinZalo,
  ngay: string
): Promise<{ tep: TepZaloDaLuu[]; boQua: string[] }> {
  const tep: TepZaloDaLuu[] = [];
  const boQua: string[] = [];
  if (goi.dinh_kem.length === 0) return { tep, boQua };
  if (!hasBlob && process.env.VERCEL) {
    for (const t of goi.dinh_kem) boQua.push(`${t.ten || '?'}: chua bat Vercel Blob`);
    return { tep, boQua };
  }

  const hanXoa = congNgay(ngay, SO_NGAY_GIU_TEP_ZALO);
  for (const [i, t] of goi.dinh_kem.entries()) {
    const kind = loaiTepZalo(t.loai);
    if (!kind) { boQua.push(`${t.ten || i}: loai ${t.loai}`); continue; }
    const ten = tenTepZalo(t.ten, kind, i);
    try {
      const noiDung = Buffer.from(t.noi_dung_base64, 'base64');
      const url = hasBlob
        ? (await put(duongDanBlobZalo(goi.nguon_id, ngay, ten), noiDung, {
            access: 'public',
            contentType: t.loai,
            // Cung ly do voi /api/upload: tep cua lop co the co mat va ten tre em
            // khac, duong dan khong duoc doan hay liet ke duoc tu ben ngoai.
            addRandomSuffix: true,
          })).url
        : await ghiTepCucBo(noiDung, ten);
      tep.push({
        ten, loai: t.loai, kind, url,
        bytes: noiDung.byteLength, gui_luc: t.gui_luc, han_xoa: hanXoa,
      });
    } catch (e) {
      boQua.push(`${ten}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { tep, boQua };
}

/**
 * Chay bo tach bai tren nguyen van tin — CUNG duong voi bo me nhap tay
 * (`POST /api/extract`): AI truoc, `splitByRule` khi khong goi duoc, va cuoi
 * cung mot bai tho giu nguyen van neu ca hai khong ra bai nao.
 *
 * Anh trong goi duoc dua kem cho AI (co doi khi chup lai to worksheet); video
 * va ghi am thi khong — model la thi giac-ngon ngu, khong doc duoc chung.
 */
async function tachBai(
  goi: GoiTinZalo,
  ngonNguNha: NgonNgu,
  T: T
): Promise<{ drafts: DraftAssignment[]; nguonTach: 'ai' | 'rule' | 'nguyen-van'; canhBao?: string }> {
  const anh = goi.dinh_kem
    .filter((t) => loaiTepZalo(t.loai) === 'image')
    .map((t) => ({ base64: t.noi_dung_base64, mimeType: t.loai }));

  if (hasAI) {
    try {
      const drafts = await extractAssignments({ text: goi.nguyen_van, images: anh }, ngonNguNha);
      if (drafts.length > 0) return { drafts, nguonTach: 'ai' };
    } catch (e) {
      const drafts = splitByRule(goi.nguyen_van, T);
      if (drafts.length > 0) {
        return { drafts, nguonTach: 'rule', canhBao: e instanceof Error ? e.message : String(e) };
      }
    }
  }
  const drafts = splitByRule(goi.nguyen_van, T);
  if (drafts.length > 0) return { drafts, nguonTach: 'rule' };
  return {
    drafts: [baiNhapTho(goi.nguyen_van, T('Khác'), iconFor('Khác'))],
    nguonTach: 'nguyen-van',
  };
}

/**
 * Tep dinh vao TUNG BAI nhap, y nhu bo me tu dinh tay: con mo bai la xem duoc
 * video mau / nghe duoc track cua co ngay tren man cua minh.
 *
 * PDF bi loai vi `AttachedMedia.kind` chi co ba loai (video/audio/image) va man
 * cua con khong co trinh doc pdf — tep pdf van nam trong `bai_tu_zalo.dinh_kem`
 * de bo me mo o man duyet.
 */
function tepDinhVaoBai(tep: TepZaloDaLuu[]): AttachedMedia[] {
  return tep
    .filter((t) => t.kind !== 'pdf')
    .map((t) => ({ url: t.url, name: t.ten, kind: t.kind as AttachedMedia['kind'] }));
}

/**
 * Nhan MOT tin giao bai: kiem trung, luu ban goc, tach bai, tao bai NHAP cho
 * tung con cua nguon.
 *
 * THU TU la hop dong, khong phai sap xep cho gon (xem chu thich dau tep):
 *   1. `INSERT ... ON CONFLICT DO NOTHING RETURNING` tren chi muc UNIQUE
 *      (nguon_id, ma_tin) — khong tra ve dong nao nghia la tin da co, DUNG NGAY
 *      va khong tao gi. Hang rao o CSDL chu khong o code: zalo-agent chay lai
 *      moi 30 phut, hai luot chong nhau la chuyen binh thuong.
 *   2. Tach bai va tao bai nhap. Loi o buoc nay KHONG nem ra ngoai: ban goc da
 *      an toan roi.
 */
export async function nhanTinZalo(goi: GoiTinZalo): Promise<KetQuaNhanTin> {
  const nguon = await getNguonZaloChoCuaNhan(goi.nguon_id);
  if (!nguon) return { ok: false, loi: 'khong-co-nguon' };
  if (!nguon.dangBat) return { ok: false, loi: 'nguon-tat' };
  if (nguon.childIds.length === 0) return { ok: false, loi: 'nguon-chua-co-con' };

  const homNay = todayISO();
  const ngayTep = goi.ngay_trong_tin ?? homNay;
  const { tep } = await taiTepLenKho(goi, ngayTep);

  const baiId = newId('bzl');
  const them = await query<{ id: string }>(
    `INSERT INTO bai_tu_zalo
       (id, nguon_id, ma_tin, gui_luc, nguoi_gui, nhom_zalo, ngay_hoc_so, ngay_trong_tin,
        nguyen_van, dinh_kem, nhan_dien)
     VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7,$8::date,$9,$10::jsonb,$11::jsonb)
     ON CONFLICT (nguon_id, ma_tin) DO NOTHING
     RETURNING id`,
    [baiId, nguon.id, goi.ma_tin, goi.gui_luc, goi.nguoi_gui,
     goi.nhom_zalo || nguon.tenNhom, goi.ngay_hoc_so, goi.ngay_trong_tin, goi.nguyen_van,
     JSON.stringify(tep), goi.nhan_dien === null ? null : JSON.stringify(goi.nhan_dien)]
  );
  if (them.length === 0) return { ok: false, loi: 'trung-ma-tin' };

  await query(`UPDATE nguon_zalo SET lan_nhan_gan_nhat = now() WHERE id = $1`, [nguon.id]);

  // Ngon ngu cua NHA (families.ui_locale) — ten mon do bo tach dat phai theo no,
  // giong duong bo me nhap tay (`POST /api/extract` doc `ngonNguHienTai`). O day
  // khong co cookie nen doc thang tu nguon -> nha.
  const nha = await queryOne<{ ui_locale: string }>(
    `SELECT ui_locale FROM families WHERE id = $1`, [nguon.familyId]);
  const ngonNgu = ngonNguOf(nha?.ui_locale);
  const T = taoT(ngonNgu);

  const { drafts, nguonTach, canhBao } = await tachBai(goi, ngonNgu, T);
  const dueDate = hanNopBai(goi.ngay_trong_tin, goi.gui_luc, homNay);

  const created = await saveSubmission({
    familyId: nguon.familyId,
    rawText: goi.nguyen_van,
    imageUrls: tep.filter((t) => t.kind === 'image').map((t) => t.url),
    childIds: nguon.childIds,
    dueDate,
    source: inferSource(drafts),
    // Tep khong phai anh (video mau, ghi am cua co) di kem TUNG BAI nhap duoi
    // dang dinh kem, y nhu bo me tu dinh tay: con mo bai la xem duoc video mau
    // ngay tren man cua minh. saveSubmission tu ghi mot ban rieng cho moi con.
    drafts: drafts.map((d) => ({ ...d, media: tepDinhVaoBai(tep) })),
    zaloBaiId: baiId,
  });

  await query(
    `UPDATE bai_tu_zalo SET ket_qua_tach = $2::jsonb WHERE id = $1`,
    [baiId, JSON.stringify({ nguon: nguonTach, canhBao: canhBao ?? null, bai: drafts })]
  );

  const con = await query<{ id: string; name: string }>(
    `SELECT id, name FROM children WHERE id = ANY($1::text[]) ORDER BY sort_order, id`,
    [nguon.childIds]
  );
  return {
    ok: true,
    baiZaloId: baiId,
    soBaiNhap: created.length,
    con: con.map((c) => ({ id: c.id, ten: c.name })),
  };
}

/* ---------------- Bo me duyet / bo ---------------- */

/**
 * Duyet MOT CHAM ca muc: moi bai nhap cua tin nay thanh bai THAT, va tu luc do
 * con thay chung tren may cua minh.
 *
 * Cau UPDATE co dieu kien `trang_thai = 'nhap'` tren chinh dong `bai_tu_zalo`
 * va doc RETURNING: bo va me cung bam Duyet thi ben sau khong lam gi (tra
 * `daXuLy`), cung khuon voi `duyetDoiThuong` (lib/sqlDiem.ts).
 *
 * Sau khi duyet thi goi `taoNhiemVuNgay` cho ngay cua cac bai vua thanh that —
 * dung tien le "moi thao tac co the lam mot ngay thanh xong het deu goi ham
 * gac +10" (AGENTS.md): tu luc nay ngay do LA mot ngay co bai cua con, nen no
 * phai co dong nhiem vu 'todo' de +10 khong duoc cong som.
 */
export async function duyetBaiZalo(
  familyId: string,
  id: string
): Promise<{ ok: true; soBai: number } | { ok: false; loi: 'khong-thay' | 'da-xu-ly' }> {
  const bai = await getBaiTuZalo(familyId, id);
  if (!bai) return { ok: false, loi: 'khong-thay' };

  const chot = await query<{ id: string }>(
    `UPDATE bai_tu_zalo SET trang_thai = 'da_duyet'
      WHERE id = $1 AND trang_thai = 'nhap' RETURNING id`,
    [id]
  );
  if (chot.length === 0) return { ok: false, loi: 'da-xu-ly' };

  const dong = await query<{ child_id: string; due_date: string | Date }>(
    `UPDATE assignments a SET trang_thai_duyet = 'that'
      WHERE a.zalo_bai_id = $1 AND a.trang_thai_duyet = 'nhap'
        AND a.child_id IN (SELECT id FROM children WHERE family_id = $2)
      RETURNING a.child_id, a.due_date`,
    [id, familyId]
  );

  const theoNgay = new Map<string, string[]>();
  for (const d of dong) {
    const ngay = d.due_date instanceof Date
      ? d.due_date.toISOString().slice(0, 10)
      : String(d.due_date).slice(0, 10);
    theoNgay.set(ngay, [...(theoNgay.get(ngay) ?? []), d.child_id]);
  }
  // Qua CHINH `taoNhiemVuNgayNeuChuaQua`, khong goi `taoNhiemVuNgay` thang: ngay
  // o day do CO GIAO chon (ngay trong tin + 1), khong phai hom nay, nen no can
  // du CA HAI luat cua ham do — tao cho ngay tu hom nay tro di (hang rao +10),
  // va KHONG tao cho ngay da qua (them mot dong khong ai tick duoc vao ngay cu
  // la khoa luon +10 cua ngay ay). Xem AGENTS.md.
  for (const [ngay, childIds] of theoNgay) {
    await taoNhiemVuNgayNeuChuaQua(familyId, ngay, childIds);
  }

  // KHONG goi `congDiemNgayNeuXong` o day, va do la mot ket luan chu khong phai
  // mot cho quen: duyet chi THEM dong 'todo' vao mot ngay, ma them viec thi
  // khong bao gio lam mot ngay thanh "xong het". Chieu nguoc lai ("Không phải
  // bài" xoa dong nhap) cung khong: dong nhap chua bao gio duoc dem
  // (`congDiemNgayNeuXong` loc `CHI_BAI_THAT`), nen bo chung di khong doi tap
  // dang duoc xet cua ngay nao ca.
  return { ok: true, soBai: dong.length };
}

/**
 * "Không phải bài": bo ca muc. Dong `bai_tu_zalo` o lai (trang_thai = 'bo') de
 * zalo-agent goi lai voi cung `ma_tin` van bi chan bang 409 — bo di roi ma lan
 * quet sau lai dung len la bo me phai bo lai moi 30 phut. Cac bai NHAP thi xoa
 * that: chung khong phai bai, giu lai chi lam nang CSDL.
 */
export async function boBaiZalo(
  familyId: string,
  id: string
): Promise<{ ok: true; soBai: number } | { ok: false; loi: 'khong-thay' | 'da-xu-ly' }> {
  const bai = await getBaiTuZalo(familyId, id);
  if (!bai) return { ok: false, loi: 'khong-thay' };

  const chot = await query<{ id: string }>(
    `UPDATE bai_tu_zalo SET trang_thai = 'bo'
      WHERE id = $1 AND trang_thai = 'nhap' RETURNING id`,
    [id]
  );
  if (chot.length === 0) return { ok: false, loi: 'da-xu-ly' };

  const xoa = await query<{ id: string }>(
    `DELETE FROM assignments a
      WHERE a.zalo_bai_id = $1 AND a.trang_thai_duyet = 'nhap'
        AND a.child_id IN (SELECT id FROM children WHERE family_id = $2)
      RETURNING a.id`,
    [id, familyId]
  );
  return { ok: true, soBai: xoa.length };
}

/** Cau hinh cho zalo-agent — dang cua hop dong `GET /api/nhan-bai-zalo/cau-hinh`. */
export async function cauHinhChoAgent(): Promise<{
  nguon: {
    id: string; nhom_zalo: string; ma_nhom: string | null; ten_co: string;
    mau_nhan_dien: string[]; cua_so_dinh_kem_phut: number;
    con: { id: string; ten: string }[];
  }[];
}> {
  const rows = await query<NguonRow & { con: unknown }>(
    `SELECT ${NGUON_SELECT},
            COALESCE(
              (SELECT json_agg(json_build_object('id', ch.id, 'ten', ch.name)
                               ORDER BY ch.sort_order, ch.id)
                 FROM nguon_zalo_con nc JOIN children ch ON ch.id = nc.child_id
                WHERE nc.nguon_id = n.id),
              '[]'::json) AS con
       FROM nguon_zalo n
      WHERE n.dang_bat
      ORDER BY n.created_at ASC, n.id ASC`
  );
  return {
    nguon: rows.map((r) => ({
      id: r.id,
      nhom_zalo: r.ten_nhom,
      ma_nhom: r.ma_nhom,
      ten_co: r.ten_co,
      mau_nhan_dien: docMauNhanDien(r.mau_nhan_dien),
      cua_so_dinh_kem_phut: Number(r.cua_so_dinh_kem_phut),
      con: (Array.isArray(r.con) ? r.con : []) as { id: string; ten: string }[],
    })),
  };
}
