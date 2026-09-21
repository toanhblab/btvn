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
 * 3. TEP KHONG DI TRONG THAN REQUEST. zalo-agent xin ve o
 *    `POST /api/nhan-bai-zalo/tep-token` roi tai THANG len Vercel Blob, va goi
 *    tin chi mang `url`. Vercel chan than request o 4.5MB nen duong base64 cu
 *    lam goi mau THAT cua scout (~4.63MB sau base64) bi 413 TRUOC khi ham chay.
 *    Doi lai, `url` gio la dau vao tu ben ngoai: `laUrlBlobZaloCuaNguon` chot
 *    no phai la tep CUA KHO MINH va dung ho `zalo/<nguon>/<ngay>/`, roi `head()`
 *    hoi lai kho xem tep co that va nang bao nhieu — KHONG tin so agent khai.
 *    Tep nao truot thi BO QUA chu khong lam hong ca goi, va phai duoc BAO RA:
 *    log may chu, than 201, va cot `bai_tu_zalo.tep_bo_qua` de man cho duyet
 *    hien; bo im lang thi bo me doi chieu nguyen van tin voi mot bo tep thieu.
 *
 * 4. Kiem TRUNG `ma_tin` truoc khi tai tep. Hang rao THAT van la chi muc UNIQUE
 *    (`INSERT ... ON CONFLICT DO NOTHING`), nhung mot phep SELECT ngan mach dat
 *    truoc do la thu duy nhat chan duoc viec zalo-agent — chay lai moi 30 phut
 *    — tai lai ca bo tep cua tin cu, moi lan mot ban moi (`addRandomSuffix`)
 *    khong dong `dinh_kem` nao tro toi va khong luot don nao thu hoi duoc.
 */

import { BlobNotFoundError, head } from '@vercel/blob';
import { query, queryOne } from './db';
import {
  listAssignments, newId, saveSubmission, taoNhiemVuNgayNeuChuaQua, todayISO,
} from './store';
import { extractAssignments, hasAI, inferSource, splitByRule } from './ai';
import { iconFor, type Assignment, type AttachedMedia, type DraftAssignment } from './types';
import { boDau, laUrlTepAppCap } from './media';
import { taoT, type T } from './i18n/chu';
import { ngonNguOf, type NgonNgu } from './i18n/ngonNgu';
import {
  baiNhapTho, docNhanDien, hanNopBai, kiemCuaSoDinhKem, loaiTepZalo, maKhoBlob,
  phanLoaiUrlBlobZalo, tenHienTep, tenTepZalo,
  CACH_TAI_TEP, DUONG_TOKEN_TEP, LOAI_TEP_NHAN, MAX_BYTES_MOI_TEP, MAX_MB_MOI_TEP,
  MAX_TEP_MOI_GOI, SO_NGAY_GIU_TEP_ZALO, congNgay,
  type GoiTinZalo, type NhanDienZalo, type TepBoQua, type TepZaloDaLuu,
} from './zalo';

/**
 * Hang so cau hinh nguon o lib/zalo.ts (tep thuan, man bo me nap duoc ma khong
 * keo theo tang may chu) — xuat lai o day de phia may chu khong phai doi cho
 * import. Xem chu thich o cho khai bao.
 */
export {
  CUA_SO_DINH_KEM_MAC_DINH, MAU_NHAN_DIEN_MAC_DINH, MAX_CHU_TEN_CO, MAX_CHU_TEN_NHOM,
  MAX_CUA_SO_DINH_KEM_PHUT, MAX_MAU_NHAN_DIEN,
} from './zalo';
import {
  MAX_MAU_NHAN_DIEN, MAX_CUA_SO_DINH_KEM_PHUT,
} from './zalo';

const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
/** Ma kho Blob CUA MINH — `null` la khong co kho hop le, va khi do moi url Blob bi tu choi. */
const MA_KHO = maKhoBlob(process.env.BLOB_READ_WRITE_TOKEN);

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

/** Buoc 3 (tach bai + tao ban nhap) da xong hay hong. */
export type TrangThaiTach = 'xong' | 'loi';

/** Toi da cho thong diep loi ghi vao `ket_qua_tach` — du de lan ra, khong hon. */
export const MAX_CHU_LOI_TACH = 300;

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
  /** Tep cua tin KHONG giu duoc, kem ly do — man cho duyet hien ra. */
  tepBoQua: TepBoQua[];
  nhanDien: NhanDienZalo | null;
  trangThai: TrangThaiBaiZalo;
  /**
   * Buoc 3 da xong chua. `null` = chua co ghi nhan nao (dong cu). Man cho duyet
   * chi canh bao khi `'loi'`, va do la thu duy nhat no can tu `ket_qua_tach` —
   * ban tach day du (`nguon` / `canhBao` / `bai`) o lai trong CSDL.
   */
  trangThaiTach: TrangThaiTach | null;
  /** Thong diep loi cua buoc 3, khi `trangThaiTach === 'loi'`. */
  loiTach: string | null;
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
  dinh_kem: unknown; tep_bo_qua: unknown; nhan_dien: unknown; trang_thai: string;
  ket_qua_tach: unknown;
  created_at: string | Date;
}

const docKetQuaTach = (v: unknown): { trangThai: TrangThaiTach | null; loi: string | null } => {
  const o = (v ?? {}) as Record<string, unknown>;
  const tt = o.trang_thai;
  if (tt !== 'xong' && tt !== 'loi') return { trangThai: null, loi: null };
  return { trangThai: tt, loi: typeof o.loi === 'string' ? o.loi : null };
};

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
  tepBoQua: Array.isArray(r.tep_bo_qua) ? (r.tep_bo_qua as TepBoQua[]) : [],
  nhanDien: docNhanDien(r.nhan_dien),
  trangThai: r.trang_thai as TrangThaiBaiZalo,
  trangThaiTach: docKetQuaTach(r.ket_qua_tach).trangThai,
  loiTach: docKetQuaTach(r.ket_qua_tach).loi,
  createdAt: new Date(r.created_at).toISOString(),
});

const BAI_COLS = `b.id, b.nguon_id, b.ma_tin, b.gui_luc, b.nguoi_gui, b.nhom_zalo,
       b.ngay_hoc_so, b.ngay_trong_tin, b.nguyen_van, b.dinh_kem, b.tep_bo_qua,
       b.nhan_dien, b.trang_thai, b.ket_qua_tach, b.created_at`;

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

/**
 * Tin nay da nhan roi chua? Chi `moCuaNhanTin` goi, va ca hai cua danh cho may
 * di qua no. Day la hang rao DUNG LUONG / cong suc, khong phai hang rao chong
 * dua — cai do la chi muc UNIQUE (nguon_id, ma_tin) o
 * `INSERT ... ON CONFLICT DO NOTHING`.
 *
 * KHONG loc theo nha, va do la co y: nguoi goi la may, `nguon_id` la thu quyet
 * dinh nha (xem chu thich dau tep).
 */
export async function tinZaloDaCo(nguonId: string, maTin: string): Promise<boolean> {
  const r = await queryOne<{ id: string }>(
    `SELECT id FROM bai_tu_zalo WHERE nguon_id = $1 AND ma_tin = $2`,
    [nguonId, maTin]
  );
  return Boolean(r);
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
  | {
      ok: true; baiZaloId: string; soBaiNhap: number;
      con: { id: string; ten: string }[];
      /** Tep cua goi khong giu duoc — rong la moi tep deu vao. */
      tepBoQua: TepBoQua[];
    }
  | { ok: false; loi: LoiCuaNhanTin };

/** Ly do mot tin bi tu choi. `trung-ma-tin` -> 409, ba cai con lai -> 404. */
export type LoiCuaNhanTin =
  | 'khong-co-nguon' | 'nguon-tat' | 'nguon-chua-co-con' | 'trung-ma-tin';

/**
 * MOT cong duy nhat cho ca hai cua danh cho may: cua phat ve tep
 * (`/api/nhan-bai-zalo/tep-token`) hoi TRUOC khi agent tai tep len, `nhanTinZalo`
 * hoi lai TRUOC khi ghi dong.
 *
 * Phai la MOT ham chu khong phai hai ban chep dieu kien. Cua phat ve chi co ich
 * khi no tu choi DUNG nhung tin ma cua nhan tin cung se tu choi; lech mot dieu
 * kien la hong ca ly do ton tai cua no, va lech lang le. Vi du sot `nguon-tat`:
 * bo me tat nguon luc 20h, agent van ky duoc ve va day hai video cua co len kho,
 * den buoc gui tin moi an 404 — luc do khong dong `bai_tu_zalo` nao tro toi bo
 * tep vua tai, tuc khong `han_xoa` va khong luot don nao thu hoi duoc, tren mot
 * kho 1GB da dung 219MB.
 */
export async function moCuaNhanTin(
  nguonId: string,
  maTin: string
): Promise<{ ok: true; nguon: NguonZalo } | { ok: false; loi: LoiCuaNhanTin }> {
  const nguon = await getNguonZaloChoCuaNhan(nguonId);
  if (!nguon) return { ok: false, loi: 'khong-co-nguon' };
  if (!nguon.dangBat) return { ok: false, loi: 'nguon-tat' };
  if (nguon.childIds.length === 0) return { ok: false, loi: 'nguon-chua-co-con' };
  if (await tinZaloDaCo(nguon.id, maTin)) return { ok: false, loi: 'trung-ma-tin' };
  return { ok: true, nguon };
}

/**
 * URL nay co dung duoc khong, va neu khong thi BO voi ly do nao?
 *
 * Tra ve LUON ma `ly_do` de nguoi goi khong phai dich lai lan hai.
 *
 * Hai dang duoc nhan, va dang thu hai CO DIEU KIEN:
 *   - Kho that (Vercel Blob): `zalo/<nguon>/<yyyy-mm-dd>/<ten>` tren kho CUA
 *     MINH (`phanLoaiUrlBlobZalo` chot ca ma kho, khong chi ten mien chung).
 *   - Dev chua bat Blob: `/api/tep/<32 hex><duoi>` — tep do `xuLyTaiTep` ghi vao
 *     `.data/uploads` qua che do multipart. CHI nhan khi may chu THAT SU chua co
 *     BLOB_READ_WRITE_TOKEN: tren Vercel ma van nhan dang nay thi co mot loi
 *     vong qua het phan kiem tien to o tren. Duong nay di TRUOC nen phep ghim ma
 *     kho khong chan nham no o may dev (o do khong co ma kho nao ca).
 */
function kiemUrlTep(url: string, nguonId: string): 'nhan' | 'ngoai-kho' | 'url-khong-nhan' {
  if (!hasBlob && url.startsWith('/api/tep/') && laUrlTepAppCap(url)) return 'nhan';
  const loai = phanLoaiUrlBlobZalo(url, nguonId, MA_KHO);
  if (loai === 'kho-minh') return 'nhan';
  return loai === 'kho-la' ? 'ngoai-kho' : 'url-khong-nhan';
}

/**
 * So byte THAT cua mot tep tren kho. `null` = kho NOI RO no khong co tep do;
 * `undefined` = khong hoi duoc, nguoi goi dung so agent khai (da kep theo tran o
 * `docGoiTin`).
 *
 * Hoi kho chu khong tin `kich_thuoc` agent khai: con so do di vao
 * `bai_tu_zalo.dinh_kem` va la thu duy nhat noi mot tep nang bao nhieu, nen mot
 * so khai bua se nam trong CSDL mai mai. Quan trong hon, `head()` con tra loi
 * cau hoi "tep nay co THAT tren kho khong" — agent tai len that bai roi van gui
 * url len thi day la cho duy nhat bat duoc.
 *
 * CHI `BlobNotFoundError` moi la cau tra loi "khong co". Loi TAM THOI cua kho
 * (`BlobServiceNotAvailable`, `BlobServiceRateLimited`, `BlobRequestAbortedError`,
 * fetch hong) KHONG tra loi cau hoi do, va gop chung vao mot nhanh la mot cu
 * rate-limit thoang qua lam MAT VINH VIEN video cua co: tin van 201 nen dong
 * `bai_tu_zalo` da ghi, va agent gui lai sau 30 phut chi nhan 409. Lui ve so
 * agent khai va GIU tep — mot con so hoi lech con hon mot tep bien mat.
 *
 * Duong dev (`/api/tep/...`) khong hoi duoc kho: cung tra `undefined`.
 */
async function soByteTrenKho(url: string): Promise<number | null | undefined> {
  if (!hasBlob || !url.startsWith('https://')) return undefined;
  try {
    const t = await head(url);
    return typeof t?.size === 'number' ? t.size : null;
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    console.warn('[nhan-bai-zalo] hoi kho loi, dung so agent khai', url, e);
    return undefined;
  }
}

/**
 * Doi chieu tung tep cua goi voi CUA SO NHAN TEP cua nguon roi voi kho tep. Tep
 * nao truot thi BO QUA va bao ra (xem chu thich dau tep) — mot video khong doi
 * chieu duoc khong duoc phep lam mat ca tin giao bai.
 *
 * Cua so kiem TRUOC khi hoi kho: mot tep nhan xet tung be (toi sau tin ~4 tieng)
 * da bi loai thi khong can mot luot `head()` cho no nua.
 */
async function nhanTepDaTai(
  goi: GoiTinZalo,
  ngay: string,
  cuaSoPhut: number
): Promise<{ tep: TepZaloDaLuu[]; boQua: TepBoQua[] }> {
  const tep: TepZaloDaLuu[] = [];
  const boQua: TepBoQua[] = [];
  const hanXoa = congNgay(ngay, SO_NGAY_GIU_TEP_ZALO);

  for (const t of goi.dinh_kem) {
    const tenHien = tenHienTep(t.ten, t.thu_tu);
    const kind = loaiTepZalo(t.loai);
    // `docGoiTin` da loc loai roi; giu lai day lam lop cuoi cho moi nguoi goi
    // khac, va de mot dot doi luat o mot ben khong lam ro ri sang ben kia.
    if (!kind) {
      boQua.push({ ten: tenHien, ly_do: 'loai-khong-nhan', chi_tiet: t.loai });
      continue;
    }
    const urlOk = kiemUrlTep(t.url, goi.nguon_id);
    if (urlOk !== 'nhan') {
      boQua.push({ ten: tenHien, ly_do: urlOk, chi_tiet: t.url.slice(0, 200) });
      continue;
    }
    const cuaSo = kiemCuaSoDinhKem(goi.gui_luc, t.gui_luc, cuaSoPhut);
    if (cuaSo !== 'trong-cua-so') {
      boQua.push({ ten: tenHien, ly_do: cuaSo, chi_tiet: t.gui_luc ?? undefined });
      continue;
    }
    const tuKho = await soByteTrenKho(t.url);
    if (tuKho === null) {
      boQua.push({ ten: tenHien, ly_do: 'khong-thay-trong-kho', chi_tiet: t.url.slice(0, 200) });
      continue;
    }
    const bytes = tuKho ?? t.kich_thuoc;
    if (bytes > MAX_BYTES_MOI_TEP) {
      boQua.push({ ten: tenHien, ly_do: 'qua-nang', chi_tiet: String(bytes) });
      continue;
    }
    tep.push({
      ten: tenTepZalo(t.ten, kind, t.thu_tu),
      loai: t.loai,
      kind,
      url: t.url,
      bytes,
      gui_luc: t.gui_luc,
      han_xoa: hanXoa,
    });
  }
  return { tep, boQua };
}

/**
 * Anh cua tin, doc VE TU KHO de dua cho bo tach bai.
 *
 * Tep khong con di trong than request nen byte cua anh khong san o day nua; ma
 * bo tach van can chung (co doi khi chup lai to worksheet — hop dong captain:
 * "voi nguyen_van kem anh neu co"). Tai ve tung anh, bo qua cai nao hong: mot
 * anh khong tai duoc chi lam ban tach kem hon, khong duoc phep lam hong ca tin.
 * Chi goi khi THAT SU co AI — khong thi day la vai MB tai ve de vut di.
 */
async function anhChoAI(tep: TepZaloDaLuu[]): Promise<{ base64: string; mimeType: string }[]> {
  const ra: { base64: string; mimeType: string }[] = [];
  for (const t of tep) {
    if (t.kind !== 'image' || !t.url.startsWith('https://')) continue;
    try {
      const res = await fetch(t.url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES_MOI_TEP) continue;
      ra.push({ base64: buf.toString('base64'), mimeType: t.loai });
    } catch {
      // Anh nay thoi; bo tach van chay tren nguyen van tin.
    }
  }
  return ra;
}

/**
 * Chay bo tach bai tren nguyen van tin — CUNG duong voi bo me nhap tay
 * (`POST /api/extract`): AI truoc, `splitByRule` khi khong goi duoc, va cuoi
 * cung mot bai tho giu nguyen van neu ca hai khong ra bai nao.
 *
 * Anh trong goi duoc dua kem cho AI; video va ghi am thi khong — model la thi
 * giac-ngon ngu, khong doc duoc chung.
 */
async function tachBai(
  nguyenVan: string,
  tep: TepZaloDaLuu[],
  ngonNguNha: NgonNgu,
  T: T
): Promise<{ drafts: DraftAssignment[]; nguonTach: 'ai' | 'rule' | 'nguyen-van'; canhBao?: string }> {
  if (hasAI) {
    const anh = await anhChoAI(tep);
    try {
      const drafts = await extractAssignments({ text: nguyenVan, images: anh }, ngonNguNha);
      if (drafts.length > 0) return { drafts, nguonTach: 'ai' };
    } catch (e) {
      const drafts = splitByRule(nguyenVan, T);
      if (drafts.length > 0) {
        return { drafts, nguonTach: 'rule', canhBao: e instanceof Error ? e.message : String(e) };
      }
    }
  }
  const drafts = splitByRule(nguyenVan, T);
  if (drafts.length > 0) return { drafts, nguonTach: 'rule' };
  return {
    drafts: [baiNhapTho(nguyenVan, T('Khác'), iconFor('Khác'))],
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
 *   1. `moCuaNhanTin` ngan mach: nguon la / dang tat / chua gan con, hoac tin da
 *      co thi DUNG NGAY. Day khong phai hang rao chong dua — no la hang rao
 *      DUNG LUONG, va cua phat ve tep goi CHINH ham do truoc do mot buoc, de
 *      zalo-agent (quet lai moi 30 phut) khong tai len ca bo tep cua mot tin ma
 *      buoc nay se tu choi: moi ban do se khong co dong `dinh_kem` nao tro toi,
 *      tuc khong `han_xoa` va khong luot don nao thu hoi duoc — tren mot kho
 *      1GB da dung 219MB.
 *   2. `INSERT ... ON CONFLICT DO NOTHING RETURNING` tren chi muc UNIQUE
 *      (nguon_id, ma_tin) — khong tra ve dong nao nghia la tin da co, DUNG NGAY
 *      va khong tao gi. Hang rao THAT chong dua nam o CSDL chu khong o code:
 *      hai luot chong nhau van phai ra dung mot dong. GIU no, dung thay bang
 *      phep SELECT o buoc 1.
 *   3. Tach bai va tao bai nhap. Loi o buoc nay KHONG nem ra ngoai: ban goc da
 *      an toan roi.
 */
export async function nhanTinZalo(goi: GoiTinZalo): Promise<KetQuaNhanTin> {
  const cong = await moCuaNhanTin(goi.nguon_id, goi.ma_tin);
  if (!cong.ok) return { ok: false, loi: cong.loi };
  const nguon = cong.nguon;

  const homNay = todayISO();
  const ngayTep = goi.ngay_trong_tin ?? homNay;
  const { tep, boQua } = await nhanTepDaTai(goi, ngayTep, nguon.cuaSoDinhKemPhut);
  const tepBoQua = [...goi.bo_qua, ...boQua];
  if (tepBoQua.length > 0) {
    // Log may chu: mot ban deploy thieu BLOB_READ_WRITE_TOKEN bo SACH tep cua
    // moi tin ma van tra 201 — khong co dong nay thi khong o dau ghi lai.
    console.warn('[nhan-bai-zalo] bo tep', goi.nguon_id, goi.ma_tin, tepBoQua);
  }

  // `nguoi_gui` va `nhom_zalo` luu Y NGUYEN thu zalo-agent doc duoc, KE CA chuoi
  // rong. Dung lay `nguon.tenCo` / `nguon.tenNhom` lap vao: rang buoc cua captain
  // la nhan dien co chi dua vao TEN HIEN THI, nen trung ten hay doi ten la vo AM
  // THAM — muc cho duyet phai hien ten THAT de bo me nhin thay. Lay ten minh tu
  // go lap vao cho trong la che dung cai tin hieu ay, o tang sau nhat.
  const baiId = newId('bzl');
  const them = await query<{ id: string }>(
    `INSERT INTO bai_tu_zalo
       (id, nguon_id, ma_tin, gui_luc, nguoi_gui, nhom_zalo, ngay_hoc_so, ngay_trong_tin,
        nguyen_van, dinh_kem, tep_bo_qua, nhan_dien)
     VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7,$8::date,$9,$10::jsonb,$11::jsonb,$12::jsonb)
     ON CONFLICT (nguon_id, ma_tin) DO NOTHING
     RETURNING id`,
    [baiId, nguon.id, goi.ma_tin, goi.gui_luc, goi.nguoi_gui,
     goi.nhom_zalo, goi.ngay_hoc_so, goi.ngay_trong_tin, goi.nguyen_van,
     JSON.stringify(tep), JSON.stringify(tepBoQua),
     goi.nhan_dien === null ? null : JSON.stringify(goi.nhan_dien)]
  );
  if (them.length === 0) return { ok: false, loi: 'trung-ma-tin' };

  // `ma_nhom` chi DIEN VAO CHO TRONG, khong bao gio de len: bo me khai nguon
  // bang TEN nhom (thu ho nhin thay tren Zalo) con ma la thu chi zalo-agent doc
  // duoc sau khi mo dung nhom (migration 021). `WHERE ma_nhom IS NULL` la ca
  // luat, dat trong CHINH cau UPDATE — mot nguon da co ma ma bi ghi de la moi
  // tin sau do chay sang nham nhom ma khong ai thay.
  await query(
    `UPDATE nguon_zalo SET lan_nhan_gan_nhat = now(),
            ma_nhom = CASE WHEN ma_nhom IS NULL THEN $2 ELSE ma_nhom END
      WHERE id = $1`,
    [nguon.id, goi.ma_nhom]
  );

  let soBaiNhap = 0;
  let con: { id: string; ten: string }[] = [];
  try {
    soBaiNhap = await tachVaTaoBaiNhap(
      { id: baiId, nguyenVan: goi.nguyen_van, ngayTrongTin: goi.ngay_trong_tin,
        guiLuc: goi.gui_luc, tep },
      nguon
    );
    con = await conCuaNguon(nguon.childIds);
  } catch (e) {
    await ghiTachLoi(baiId, e);
  }

  return { ok: true, baiZaloId: baiId, soBaiNhap, con, tepBoQua };
}

/**
 * BUOC 3 tach rieng, vi no co HAI nguoi goi va chung phai chay y het nhau:
 * `nhanTinZalo` luc tin vao, va `tachLaiBaiZalo` khi bo me bam "Tách lại". Hai
 * ban chep la hai luat tach bai khac nhau ma khong ai thay.
 *
 * Doc tu DONG `bai_tu_zalo` chu khong tu goi tin: luc bo me bam "Tách lại" thi
 * goi tin khong con nua, dong do la ban duy nhat con lai.
 */
async function tachVaTaoBaiNhap(
  tin: { id: string; nguyenVan: string; ngayTrongTin: string | null;
         guiLuc: string | null; tep: TepZaloDaLuu[] },
  nguon: NguonZalo
): Promise<number> {
  // Ngon ngu cua NHA (families.ui_locale) — ten mon do bo tach dat phai theo no,
  // giong duong bo me nhap tay (`POST /api/extract` doc `ngonNguHienTai`). O day
  // khong co cookie nen doc thang tu nguon -> nha.
  const nha = await queryOne<{ ui_locale: string }>(
    `SELECT ui_locale FROM families WHERE id = $1`, [nguon.familyId]);
  const ngonNgu = ngonNguOf(nha?.ui_locale);
  const T = taoT(ngonNgu);

  const { drafts, nguonTach, canhBao } = await tachBai(tin.nguyenVan, tin.tep, ngonNgu, T);
  const dueDate = hanNopBai(tin.ngayTrongTin, tin.guiLuc, todayISO());

  const created = await saveSubmission({
    familyId: nguon.familyId,
    rawText: tin.nguyenVan,
    imageUrls: tin.tep.filter((t) => t.kind === 'image').map((t) => t.url),
    childIds: nguon.childIds,
    dueDate,
    source: inferSource(drafts),
    // Tep khong phai anh (video mau, ghi am cua co) di kem TUNG BAI nhap duoi
    // dang dinh kem, y nhu bo me tu dinh tay: con mo bai la xem duoc video mau
    // ngay tren man cua minh. saveSubmission tu ghi mot ban rieng cho moi con.
    drafts: drafts.map((d) => ({ ...d, media: tepDinhVaoBai(tin.tep) })),
    zaloBaiId: tin.id,
  });

  await query(
    `UPDATE bai_tu_zalo SET ket_qua_tach = $2::jsonb WHERE id = $1`,
    [tin.id, JSON.stringify({
      trang_thai: 'xong', loi: null, nguon: nguonTach, canhBao: canhBao ?? null, bai: drafts,
    })]
  );
  return created.length;
}

const conCuaNguon = async (childIds: string[]): Promise<{ id: string; ten: string }[]> => {
  const con = await query<{ id: string; name: string }>(
    `SELECT id, name FROM children WHERE id = ANY($1::text[]) ORDER BY sort_order, id`,
    [childIds]
  );
  return con.map((c) => ({ id: c.id, ten: c.name }));
};

/**
 * Buoc 3 hong thi GHI LAI, dung nem ra ngoai.
 *
 * Dong `bai_tu_zalo` da commit truoc do, va `moCuaNhanTin` se tra 409 cho moi
 * lan zalo-agent quet lai — de loi thoat ra thanh 500 la tin do ket VINH VIEN o
 * mot bo bai nhap do dang, khong con duong nao dua no vao lai. Nen thay vao do:
 * danh dau tach = 'loi' ngay tren dong da co, van tra 201, va bo me bam "Tách
 * lại" o muc cho duyet de chay lai buoc 3.
 */
async function ghiTachLoi(baiId: string, e: unknown): Promise<void> {
  console.error('[nhan-bai-zalo] tach bai loi', baiId, e);
  const loi = (e instanceof Error ? e.message : String(e)).slice(0, MAX_CHU_LOI_TACH);
  try {
    await query(
      `UPDATE bai_tu_zalo SET ket_qua_tach = $2::jsonb WHERE id = $1`,
      [baiId, JSON.stringify({ trang_thai: 'loi', loi })]
    );
  } catch (e2) {
    // Ghi nhan that bai cung that bai: khong con gi lam duoc, va van KHONG nem.
    console.error('[nhan-bai-zalo] khong ghi noi trang thai tach', baiId, e2);
  }
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

  const xoa = await xoaBaiNhapCuaTin(familyId, id);
  return { ok: true, soBai: xoa };
}

/**
 * Xoa cac ban NHAP cua mot tin. Hai dieu kien di CUNG NHAU va khong duoc bo cai
 * nao: `trang_thai_duyet = 'nhap'` (mot dong da thanh bai THAT la bai con dang
 * lam — khong bao gio duoc xoa o day) va loc theo nha.
 */
async function xoaBaiNhapCuaTin(familyId: string, baiZaloId: string): Promise<number> {
  const xoa = await query<{ id: string }>(
    `DELETE FROM assignments a
      WHERE a.zalo_bai_id = $1 AND a.trang_thai_duyet = 'nhap'
        AND a.child_id IN (SELECT id FROM children WHERE family_id = $2)
      RETURNING a.id`,
    [baiZaloId, familyId]
  );
  return xoa.length;
}

/**
 * "Tách lại": chay lai BUOC 3 cho mot tin da vao nhung tach hong.
 *
 * Duong cua NGUOI (can PIN bo me), khac ba cua `/api/nhan-bai-zalo*` danh cho
 * may. Ly do no ton tai: dong `bai_tu_zalo` da vao thi `moCuaNhanTin` tra 409
 * mai mai, nen neu buoc 3 hong giua chung thi khong con duong nao khac dua tin
 * do vao lai.
 *
 * BA HANG RAO:
 *   a. CHI chay khi tin dang o `'nhap'`. Tach lai mot tin DA DUYET la dung lai
 *      ban nhap cua nhung bai con dang lam; tach lai mot tin DA BO la dung lai
 *      dung thu bo me vua vut di.
 *   b. Xoa qua `xoaBaiNhapCuaTin` — dieu kien `'nhap'` + loc nha, y nhu
 *      `boBaiZalo`.
 *   c. IDEMPOTENT nho xoa-roi-tao-lai: goi hai lan ra cung mot ket qua, khong
 *      nhan doi bai. (a) va (b) la thu giu cho phep xoa do luon an toan.
 */
export async function tachLaiBaiZalo(
  familyId: string,
  id: string
): Promise<
  | { ok: true; soBai: number; baiNhap: Assignment[] }
  | { ok: false; loi: 'khong-thay' | 'da-xu-ly' | 'tach-loi' }
> {
  const bai = await getBaiTuZalo(familyId, id);
  if (!bai) return { ok: false, loi: 'khong-thay' };
  if (bai.trangThai !== 'nhap') return { ok: false, loi: 'da-xu-ly' };

  const nguon = await getNguonZalo(familyId, bai.nguonId);
  if (!nguon) return { ok: false, loi: 'khong-thay' };

  await xoaBaiNhapCuaTin(familyId, id);
  try {
    const soBai = await tachVaTaoBaiNhap(
      { id, nguyenVan: bai.nguyenVan, ngayTrongTin: bai.ngayTrongTin,
        guiLuc: bai.guiLuc, tep: bai.dinhKem },
      nguon
    );
    const baiNhap = await listAssignments(familyId, {
      keCaNhap: true, zaloBaiId: id, includeChores: true,
    });
    return { ok: true, soBai, baiNhap };
  } catch (e) {
    await ghiTachLoi(id, e);
    return { ok: false, loi: 'tach-loi' };
  }
}

/**
 * Cau hinh cho zalo-agent — dang cua hop dong `GET /api/nhan-bai-zalo/cau-hinh`.
 *
 * LOC NHA DEMO ra, bang dung hang rao 9 cua lib/donVideo.ts
 * (`family_id NOT LIKE 'fam\_demo\_%'`, dau gach duoi la ky tu dai dien cua
 * LIKE nen phai thoat). Ba nha demo duoc seed lai o MOI ban `npm run build` voi
 * hai nguon mang DUNG ten nhom va ten co cua lop that, ma ten nhom la khoa duy
 * nhat zalo-agent doi chieu duoc — khong loc thi mot tin cua co ra bon nguon
 * khong phan biet noi: hoac agent gui bai (va tep co mat cac chau) vao ca ba
 * nha ai cung mo duoc bang PIN demo 1111/2222/3333, hoac no chon mot nguon va
 * nha THAT khong bao gio nhan duoc bai.
 *
 * Loc o DAY chu khong o cho seed (`dang_bat = FALSE`): cong tac bat/tat nam
 * ngay tren man bo me cua nha demo, ai bat len la ho lai. Va cung vi the man bo
 * me VAN thay hai nguon mau khi captain di demo — chi cua danh cho MAY la khong.
 */
export async function cauHinhChoAgent(): Promise<{
  nguon: {
    id: string; nhom_zalo: string; ma_nhom: string | null; ten_co: string;
    mau_nhan_dien: string[]; cua_so_dinh_kem_phut: number;
    con: { id: string; ten: string }[];
  }[];
  /**
   * Tran cua cua nhan + CACH dua tep vao, de zalo-agent biet TRUOC thay vi gui
   * len roi bi bo. `cach_tai` / `duong_token` la phan hop dong doi khi bo duong
   * base64: agent xin ve o `duong_token` roi tai thang len kho.
   */
  gioi_han: {
    loai_tep: string[]; toi_da_mb: number; toi_da_tep_moi_goi: number;
    cach_tai: string; duong_token: string;
  };
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
        AND n.family_id NOT LIKE 'fam\\_demo\\_%'
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
    gioi_han: {
      loai_tep: [...LOAI_TEP_NHAN],
      toi_da_mb: MAX_MB_MOI_TEP,
      toi_da_tep_moi_goi: MAX_TEP_MOI_GOI,
      cach_tai: CACH_TAI_TEP,
      duong_token: DUONG_TOKEN_TEP,
    },
  };
}
