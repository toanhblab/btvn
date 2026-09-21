/**
 * Hop dong cua "cua nhan bai tu Zalo" — phan THUAN: doc va lam sach goi tin,
 * luat dat han bai, luat tep dinh kem, cach doc co nhan dien.
 *
 * Tach khoi lib/nhanBaiZalo.ts (phan cham CSDL va Blob) vi day la phan co the
 * kiem bang goi mau THAT (`lib/zalo.test.ts` nap thang latest.json cua scout),
 * va vi cung tep nay la BAN HOP DONG ma zalo-agent (kho khac, viet Python) phai
 * khop: doi ten truong o day la doi ca hai ben.
 *
 * Tep KHONG import gi luc chay (chi `import type`) — cung ly do voi
 * lib/sqlNhiemVu.ts va lib/muiGio.ts: `node --test` va script .mjs nap duoc.
 *
 * Ten truong trong goi tin la TIENG VIET KHONG DAU (`ma_tin`, `nguyen_van`,
 * `dinh_kem`...) theo hop dong captain da chot; doi lai, kieu TypeScript trong
 * tep nay dung ten do y nguyen chu khong dich sang camelCase, de doc mot dong
 * la biet no di thang tu goi tin ra hay khong.
 */

import type { DraftAssignment } from './types';

/* ---------------- Tep dinh kem ---------------- */

/**
 * Tran MOI TEP, khong phai tran ca goi. 25MB theo hop dong captain chot —
 * rong hon hai video mau that cua co (2.2MB va 1.3MB) mot bac lon, ma van du
 * chat de mot goi hong khong nuot het bo nho cua ham serverless.
 *
 * KHAC voi MAX_MEDIA_BYTES (100MB, lib/media.ts): tep o day di qua THAN
 * REQUEST duoi dang base64, ma Vercel chan than request o 4.5MB — nen tran
 * 25MB chi la hang rao cuoi, con han thuc te chat hon nhieu va do zalo-agent
 * phai biet. Duong bo me dinh kem tay van la duong upload thang len Blob
 * (lib/upload-route.ts), khong dung tran nay.
 */
export const MAX_BYTES_MOI_TEP = 25 * 1024 * 1024;

/** So tep toi da mot goi — do duoc: mot tin giao bai co nhieu nhat 2 video. */
export const MAX_TEP_MOI_GOI = 10;

/**
 * Loai tep nhan: anh, am thanh, video, pdf (hop dong captain chot). Do theo
 * TIEN TO cua MIME chu khong theo danh sach duoi tep: co giao gui tu iPhone
 * (.mov, .m4a, .heic) va tu may tinh (.mp4, .mp3, .wav) — liet ke duoi la
 * chac chan sot.
 */
export type LoaiTepZalo = 'image' | 'audio' | 'video' | 'pdf';

export function loaiTepZalo(mime: unknown): LoaiTepZalo | null {
  if (typeof mime !== 'string') return null;
  const m = mime.toLowerCase().split(';')[0].trim();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  if (m === 'application/pdf') return 'pdf';
  return null;
}

/**
 * Tep sau khi da luu — dang luu trong `bai_tu_zalo.dinh_kem`.
 *
 * `han_xoa` la NGAY (YYYY-MM-DD) tu do tro di tep nay khong can giu nua. Viec
 * don THAT chua co: lib/donVideo.ts co y chi di theo `assignments
 * .submitted_video_url` va `laUrlVideoConNop` chi nhan thu muc `nop-bai/` —
 * noi ra de xoa them mot thu muc la noi dung hang rao 3 cua mot duong xoa
 * khong lui duoc. Nen o day chi GHI SAN han; viec don la viec sau (ghi trong
 * PR + README).
 */
export interface TepZaloDaLuu {
  ten: string;
  loai: string;
  kind: LoaiTepZalo;
  url: string;
  bytes: number;
  gui_luc: string | null;
  han_xoa: string;
}

/** Tep giu bao lau truoc khi duoc phep don — cung bac voi video con nop (5 ngay). */
export const SO_NGAY_GIU_TEP_ZALO = 30;

/* ---------------- Ngay ---------------- */

/** YYYY-MM-DD hop le? (khong nhan '2026-13-40' — Date tu chuan hoa thi lech). */
export function laNgayISO(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Cong `n` ngay vao mot ngay lich, tren lich UTC.
 *
 * KHONG dung `lechNgay` cua lib/ngay.ts (no di qua `Date` gio dia phuong cua
 * may chay): o day dau vao va dau ra deu la NGAY LICH thuan, khong co mui gio
 * nao dinh vao, nen phep cong phai lam tren UTC — ham Vercel chay TZ=UTC con
 * may dev chay +07 ma ket qua phai giong nhau (cung lop loi voi issue #75).
 */
export function congNgay(ngay: string, n: number): string {
  const [y, m, d] = ngay.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Han nop cua bai tach tu mot tin: NGAY TRONG TIN + 1.
 *
 * Co dang bai toi nay cho buoi hoc sau, nen han mac dinh la HOM SAU ngay ghi
 * trong tin (hop dong captain chot). Bo me doi duoc o man sua bai — day chi la
 * mac dinh, khong phai luat.
 *
 * Tin khong doc ra ngay (cô viet khac khuon, hay zalo-agent khong tach duoc)
 * thi lui ve NGAY GUI TIN + 1; khong co ca ngay gui thi ve `homNay` + 1. Khong
 * bao gio tra ve ngay QUA KHU: bai co han hom qua khong hien tren man cua con
 * o nhom "hom nay" ma tut ngay xuong "bai con no", con bo me thi vua bam duyet
 * xong da thay mot bai qua han.
 */
export function hanNopBai(
  ngayTrongTin: string | null,
  ngayGuiTin: string | null,
  homNay: string
): string {
  const goc = laNgayISO(ngayTrongTin) ? ngayTrongTin : laNgayISO(ngayGuiTin) ? ngayGuiTin : homNay;
  const han = congNgay(goc, 1);
  return han < homNay ? homNay : han;
}

/* ---------------- Co nhan dien (zalo-agent gui kem) ---------------- */

/**
 * zalo-agent nhan dien tin giao bai bang HAI LOP (ke hoach 2026-09-21, muc 2b):
 * LUAT (nguoi gui la co + tin co du mau nhan dien) va JEV (model cham xac suat
 * "tin nay co phai co giao bai khong"). btvn chi LUU va HIEN co — khong co
 * nhanh nao doc no de quyet dinh gi, vi moi sai lech da dung o buoc bo me
 * duyet roi.
 */
export interface NhanDienZalo {
  luat: boolean;
  jev_xac_suat: number | null;
}

export function docNhanDien(v: unknown): NhanDienZalo | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.luat !== 'boolean') return null;
  const p = o.jev_xac_suat;
  return {
    luat: o.luat,
    jev_xac_suat: typeof p === 'number' && Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : null,
  };
}

/** Ba mat cua co, de man bo me chon dung cau (khoa dich nam o noi hien). */
export type MatCoNhanDien = 'luat-khop' | 'jev-doan' | 'chua-qua-jev';

export function matCoNhanDien(nd: NhanDienZalo | null): MatCoNhanDien | null {
  if (!nd) return null;
  if (nd.luat) return 'luat-khop';
  return nd.jev_xac_suat === null ? 'chua-qua-jev' : 'jev-doan';
}

/* ---------------- Goi tin ---------------- */

/** Mot tep trong goi tin gui len (truoc khi luu). */
export interface TepTrongGoi {
  ten: string;
  loai: string;
  gui_luc: string | null;
  noi_dung_base64: string;
}

export interface GoiTinZalo {
  nguon_id: string;
  ma_tin: string;
  gui_luc: string | null;
  nguoi_gui: string;
  nhom_zalo: string;
  ngay_hoc_so: number | null;
  ngay_trong_tin: string | null;
  nguyen_van: string;
  dinh_kem: TepTrongGoi[];
  nhan_dien: NhanDienZalo | null;
}

/**
 * Ma loi cua goi tin hong — CHUOI MAY DOC, khong hien len man nao (cua nay do
 * zalo-agent goi, khong phai nguoi), nen khong qua lop dich. Cung tinh than
 * voi /api/don-video.
 */
export type LoiGoiTin =
  | 'thieu-nguon-id'
  | 'thieu-ma-tin'
  | 'thieu-nguyen-van'
  | 'qua-nhieu-tep'
  | 'tep-sai-loai'
  | 'tep-qua-nang'
  | 'tep-hong';

export const MAX_CHU_NGUYEN_VAN = 20_000;

const chuoi = (v: unknown, max = 200): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

/** Moc ISO hop le thi giu nguyen chuoi, khong thi null (de CSDL nhan null). */
function mocISO(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : v.trim();
}

/**
 * So byte THAT cua mot chuoi base64, khong phai do dai chuoi. Tinh truoc khi
 * decode de mot goi 200MB khong bao gio duoc dung thanh Buffer trong ham
 * serverless — `Buffer.from(...)` roi do `.length` la da tra gia roi.
 */
export function bytesCuaBase64(s: string): number {
  const sach = s.replace(/[\r\n\s]/g, '');
  const dem = sach.endsWith('==') ? 2 : sach.endsWith('=') ? 1 : 0;
  return Math.floor((sach.length * 3) / 4) - dem;
}

/**
 * Doc goi tin tu than request. KHONG cham CSDL va khong decode tep — chi lam
 * sach va chan o cac tran; nguoi goi decode sau khi da qua day.
 *
 * Tra ve `{ loi }` thay vi nem: cua nhan phai phan biet duoc "goi hong" (400)
 * voi "tach bai hong" (van 201, luu ban goc — xem app/api/nhan-bai-zalo).
 */
export function docGoiTin(
  body: unknown
): { goi: GoiTinZalo } | { loi: LoiGoiTin; chiTiet?: string } {
  const b = (body ?? {}) as Record<string, unknown>;

  const nguonId = chuoi(b.nguon_id, 64);
  if (!nguonId) return { loi: 'thieu-nguon-id' };
  const maTin = chuoi(b.ma_tin, 200);
  if (!maTin) return { loi: 'thieu-ma-tin' };
  const nguyenVan = typeof b.nguyen_van === 'string' ? b.nguyen_van.trim() : '';
  if (!nguyenVan) return { loi: 'thieu-nguyen-van' };

  const tho = Array.isArray(b.dinh_kem) ? b.dinh_kem : [];
  if (tho.length > MAX_TEP_MOI_GOI) return { loi: 'qua-nhieu-tep' };

  const dinhKem: TepTrongGoi[] = [];
  for (const [i, t] of tho.entries()) {
    const o = (t ?? {}) as Record<string, unknown>;
    const loai = chuoi(o.loai, 120);
    if (!loaiTepZalo(loai)) return { loi: 'tep-sai-loai', chiTiet: `${i}: ${loai || '?'}` };
    const b64 = typeof o.noi_dung_base64 === 'string' ? o.noi_dung_base64 : '';
    if (!b64) return { loi: 'tep-hong', chiTiet: `${i}` };
    const bytes = bytesCuaBase64(b64);
    if (bytes <= 0) return { loi: 'tep-hong', chiTiet: `${i}` };
    if (bytes > MAX_BYTES_MOI_TEP) {
      return { loi: 'tep-qua-nang', chiTiet: `${i}: ${bytes}` };
    }
    dinhKem.push({
      // Tep tu Zalo hay KHONG CO TEN (bong bong video chi co key) — dat ten
      // theo thu tu de man bo me co gi de hien; duoi tep do loai quyet dinh.
      ten: chuoi(o.ten, 200),
      loai,
      gui_luc: mocISO(o.gui_luc),
      noi_dung_base64: b64,
    });
  }

  const soNgayHoc = Number(b.ngay_hoc_so);

  return {
    goi: {
      nguon_id: nguonId,
      ma_tin: maTin,
      gui_luc: mocISO(b.gui_luc),
      nguoi_gui: chuoi(b.nguoi_gui, 200),
      nhom_zalo: chuoi(b.nhom_zalo, 300),
      ngay_hoc_so: Number.isInteger(soNgayHoc) && soNgayHoc > 0 ? soNgayHoc : null,
      ngay_trong_tin: laNgayISO(b.ngay_trong_tin) ? b.ngay_trong_tin : null,
      nguyen_van: nguyenVan.slice(0, MAX_CHU_NGUYEN_VAN),
      dinh_kem: dinhKem,
      nhan_dien: docNhanDien(b.nhan_dien),
    },
  };
}

/**
 * Thu muc tren Vercel Blob: `zalo/<nguon>/<yyyy-mm-dd>/<ten>` (hop dong captain
 * chot). Tien to rieng, KHONG trung `nop-bai/` cua video con nop — `laUrlVideoConNop`
 * (lib/donVideo.ts) chi nhan `nop-bai/` nen mot luot don video khong bao gio
 * cham vao tep o day. Doi tien to nay la phai xem lai ca hai ben.
 */
export function duongDanBlobZalo(nguonId: string, ngay: string, ten: string): string {
  // Ten tep tu Zalo la chuoi tu do (co giao dat), nen chi giu bo ky tu an toan
  // va GOP moi day dau cham lai thanh mot: `/` da bi thay roi nhung de nguyen
  // `..` trong mot doan duong dan la mot thu khong ai muon phai suy nghi lai.
  const sach = (s: string) =>
    s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[-.]+|[-.]+$/g, '') || 'tep';
  return `zalo/${sach(nguonId)}/${ngay}/${sach(ten)}`;
}

/** Duoi tep mac dinh khi ten tu Zalo khong co duoi nhan ra duoc. */
const DUOI_MAC_DINH: Record<LoaiTepZalo, string> = {
  video: '.mp4',
  audio: '.m4a',
  image: '.jpg',
  pdf: '.pdf',
};

/** Ten tep de luu: giu ten goc neu co duoi, khong thi dat theo loai + thu tu. */
export function tenTepZalo(ten: string, kind: LoaiTepZalo, thuTu: number): string {
  if (/\.[A-Za-z0-9]{1,5}$/.test(ten)) return ten;
  return `${ten || `${kind}-${thuTu + 1}`}${DUOI_MAC_DINH[kind]}`;
}

/**
 * Ban tach THO cuoi cung khi ca AI lan `splitByRule` deu khong ra bai nao.
 *
 * Cua nhan KHONG BAO GIO duoc 500 tay khong (hop dong): tin cua co da nam trong
 * CSDL roi, nen phai co it nhat mot bai nhap de bo me mo ra sua — khong thi bo
 * me thay mot muc "chờ duyệt" rong, khong biet lam gi voi no. Mot bai, nguyen
 * van lam de, do tin 0.3 de man Kiem tra lai canh bao nhu ban tach tho.
 */
export function baiNhapTho(nguyenVan: string, subject: string, icon: string): DraftAssignment {
  return {
    subject,
    icon,
    content: nguyenVan.slice(0, 2000),
    note: null,
    lang: 'vi',
    confidence: 0.3,
    durationMinutes: 10,
    requiresVideo: false,
  };
}
