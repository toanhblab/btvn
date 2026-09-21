/**
 * Hop dong cua "cua nhan bai tu Zalo" — phan THUAN: doc va lam sach goi tin,
 * luat dat han bai, luat tep dinh kem, cach doc co nhan dien.
 *
 * Tach khoi lib/nhanBaiZalo.ts (phan cham CSDL va Blob) vi day la phan co the
 * kiem bang goi mau THAT (`lib/zalo.test.ts` nap thang latest.json cua scout),
 * va vi cung tep nay la BAN HOP DONG ma zalo-agent (kho khac, viet Python) phai
 * khop: doi ten truong o day la doi ca hai ben.
 *
 * Tep chi import lib/muiGio.ts luc chay — chinh tep do CO Y khong import gi,
 * nen ca nhanh nay van la la: `node --test` va script .mjs nap duoc, cung ly do
 * voi lib/sqlNhiemVu.ts.
 *
 * Ten truong trong goi tin la TIENG VIET KHONG DAU (`ma_tin`, `nguyen_van`,
 * `dinh_kem`...) theo hop dong captain da chot; doi lai, kieu TypeScript trong
 * tep nay dung ten do y nguyen chu khong dich sang camelCase, de doc mot dong
 * la biet no di thang tu goi tin ra hay khong.
 */

import { ngayNhaISO } from './muiGio';
import type { DraftAssignment } from './types';

/* ---------------- Tep dinh kem ---------------- */

/**
 * Tran MOI TEP. 25MB theo hop dong captain chot — rong hon hai video mau that
 * cua co (2.2MB va 1.3MB) mot bac lon.
 *
 * Con so nay la tran THAT va zalo-agent doc duoc no o `gioi_han` cua GET
 * cau-hinh, vi tep KHONG di qua than request: agent xin ve o
 * `POST /api/nhan-bai-zalo/tep-token` roi tai THANG len Vercel Blob, y het
 * duong tep bo me dinh kem va video con nop (lib/media.ts + lib/upload-route.ts).
 * Duong base64-trong-than-request da BO HAN: Vercel chan than request o 4.5MB
 * nen goi mau THAT cua scout (2.18MB + 1.29MB video -> ~4.63MB sau base64) bi
 * 413 TRUOC khi ham chay — khong dong `bai_tu_zalo`, khong ban nhap, khong log,
 * va agent gui lai moi 30 phut mai mai.
 */
export const MAX_BYTES_MOI_TEP = 25 * 1024 * 1024;

/** So tep toi da mot goi — do duoc: mot tin giao bai co nhieu nhat 2 video. */
export const MAX_TEP_MOI_GOI = 10;

/* ---------------- Cau hinh nguon (hang so dung chung) ---------------- */

/**
 * Nam hang so nay o DAY chu khong o lib/nhanBaiZalo.ts vi man bo me
 * (`app/bome/(khung)/zalo/NguonZalo.tsx`, mot component `'use client'`) can
 * CHUNG duoi dang GIA TRI. lib/nhanBaiZalo.ts import `@vercel/blob`, `./db`
 * (-> `@neondatabase/serverless`, `@electric-sql/pglite`, `node:fs`), `./store`
 * va `./ai` o top level, nen lay gia tri tu do la keo ca tang may chu vao goi
 * trinh duyet chi de lay may con so. Tep nay khong import gi ngoai lib/muiGio.ts.
 * lib/nhanBaiZalo.ts xuat lai chung de phia may chu khong phai doi cho import.
 */
/** Ten nhom / ten co dai hon thi tran the tren man dien thoai cua bo me. */
export const MAX_CHU_TEN_NHOM = 80;
export const MAX_CHU_TEN_CO = 40;
/** So mau nhan dien toi da — nhieu hon thi khong con la "mau", ma la mot bo loc. */
export const MAX_MAU_NHAN_DIEN = 8;
export const MAU_NHAN_DIEN_MAC_DINH = ['bai tap ve nha', 'ngay hoc thu'];
export const CUA_SO_DINH_KEM_MAC_DINH = 90;
export const MAX_CUA_SO_DINH_KEM_PHUT = 1440;

/**
 * Loai tep nhan: anh, am thanh, video, pdf (hop dong captain chot). Do theo
 * TIEN TO cua MIME chu khong theo danh sach duoi tep: co giao gui tu iPhone
 * (.mov, .m4a, .heic) va tu may tinh (.mp4, .mp3, .wav) — liet ke duoi la
 * chac chan sot.
 */
export type LoaiTepZalo = 'image' | 'audio' | 'video' | 'pdf';

/**
 * Danh sach loai tep nhan, dang MAY DOC — `GET /api/nhan-bai-zalo/cau-hinh` tra
 * no ve trong `gioi_han` de zalo-agent biet TRUOC cai gi se bi bo, thay vi gui
 * len roi doc mot dong "da bo" trong than 201.
 */
export const LOAI_TEP_NHAN = ['image/*', 'audio/*', 'video/*', 'application/pdf'] as const;

/** Cung mot tran voi `MAX_BYTES_MOI_TEP`, don vi MB — dang zalo-agent doc. */
export const MAX_MB_MOI_TEP = MAX_BYTES_MOI_TEP / (1024 * 1024);

/**
 * Cach zalo-agent dua tep vao, va duong xin ve — hai truong cua `gioi_han`
 * trong GET cau-hinh. Ghi RA THANH GIA TRI chu khong de agent doan: doi cach
 * tai la doi hop dong, va agent phai thay no doi.
 */
export const CACH_TAI_TEP = 'blob-client-token';
export const DUONG_TOKEN_TEP = '/api/nhan-bai-zalo/tep-token';

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
 *
 * `ngayGuiTin` la MOC DAY DU ('2026-09-18T20:03:17+07:00'), khong phai ngay lich
 * — do la thu zalo-agent gui len. Rut ngay ra bang `ngayNhaISO` (mui gio nha)
 * chu khong so thang bang `laNgayISO`: so thang thi nhanh giua khong bao gio
 * chay (mot moc ISO khong khop `^\d{4}-\d{2}-\d{2}$`) va tin cu ve dung
 * `homNay` + 1, tuc han tre mot ngay ma khong bao gi. Va KHONG dung
 * `new Date(...).getDate()`: ham Vercel chay TZ=UTC con nha o +07 nen mot tin
 * gui 22h gio nha se ra ngay hom truoc (cung lop loi voi issue #75).
 */
export function hanNopBai(
  ngayTrongTin: string | null,
  ngayGuiTin: string | null,
  homNay: string
): string {
  const goc = laNgayISO(ngayTrongTin) ? ngayTrongTin : ngayLichCuaMoc(ngayGuiTin) ?? homNay;
  const han = congNgay(goc, 1);
  return han < homNay ? homNay : han;
}

/** Ngay lich (mui gio nha) cua mot moc ISO; moc hong / thieu thi null. */
export function ngayLichCuaMoc(moc: string | null): string | null {
  if (typeof moc !== 'string' || !moc.trim()) return null;
  if (laNgayISO(moc)) return moc;
  const d = new Date(moc);
  return Number.isNaN(d.getTime()) ? null : ngayNhaISO(d);
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
  /** So byte zalo-agent KHAI. Chi de bao truoc; so that lay tu kho tep. */
  kich_thuoc: number;
  gui_luc: string | null;
  /** URL tep da nam tren kho cua CHINH app nay (xem `laUrlBlobZaloCuaNguon`). */
  url: string;
  /**
   * Vi tri trong goi THO — MOT khong gian chi so duy nhat, di tu `docGoiTin`
   * den luc dat ten tep va den luc bao `tep_bo_qua`.
   *
   * Phai mang theo chu khong dem lai: mang nay DA LOC, nen dem lai la hai tep
   * khac nhau cung ra `#1` trong danh sach "tep co gui khong vao duoc" cua bo me
   * — mot tep bi `docGoiTin` bo o vi tri tho 0, mot tep bi `nhanTepDaTai` bo o vi
   * tri 0 cua mang con lai. Do dung la thu ma cai ten thay the sinh ra de phan
   * biet.
   */
  thu_tu: number;
}

/**
 * Ten de HIEN cho bo me khi tep khong co ten. Tep tu Zalo hay khong co ten
 * (bong bong video chi co key), nen so thu tu la thu duy nhat phan biet chung.
 * MOT ban duy nhat, doc `thu_tu` cua goi tho — xem `TepTrongGoi.thu_tu`.
 */
export const tenHienTep = (ten: string, thuTu: number): string => ten || `#${thuTu + 1}`;

/**
 * Mot tep KHONG duoc giu lai, kem ly do — MOT danh sach duy nhat cho ba cho co
 * the bo tep: luc doc goi (sai loai, agent khai qua 25MB, thieu url), luc doi
 * chieu voi CUA SO NHAN TEP cua nguon (`kiemCuaSoDinhKem`), va luc doi chieu voi
 * kho tep (url khong phai cua kho minh / sai tien to cua nguon, hoac kho bao
 * khong co tep do). Luu cung dong `bai_tu_zalo` va hien o muc cho duyet, de bo
 * me biet co mot tep cua co khong vao duoc chu khong phai doan.
 *
 * `ly_do` la MA MAY DOC: cua nay do zalo-agent goi nen than 201 khong qua lop
 * dich; man bo me tu chon cau cho tung ma.
 */
export type LyDoBoTep =
  | 'loai-khong-nhan'
  | 'qua-nang'
  | 'tep-hong'
  | 'url-khong-nhan'
  | 'khong-thay-trong-kho'
  | 'ngoai-cua-so'
  | 'thieu-gio-gui';

export interface TepBoQua {
  ten: string;
  ly_do: LyDoBoTep;
  /** Them chu cho dong log cua may chu; man bo me khong ve truong nay. */
  chi_tiet?: string;
}

export interface GoiTinZalo {
  nguon_id: string;
  ma_tin: string;
  gui_luc: string | null;
  nguoi_gui: string;
  nhom_zalo: string;
  /** Ma nhom Zalo ('g694851...') zalo-agent doc duoc sau khi mo dung nhom. */
  ma_nhom: string | null;
  ngay_hoc_so: number | null;
  ngay_trong_tin: string | null;
  nguyen_van: string;
  dinh_kem: TepTrongGoi[];
  /** Tep cua goi KHONG giu duoc — tin van vao, chi thieu tep do. */
  bo_qua: TepBoQua[];
  nhan_dien: NhanDienZalo | null;
}

/**
 * Ma loi cua goi tin hong — CHUOI MAY DOC, khong hien len man nao (cua nay do
 * zalo-agent goi, khong phai nguoi), nen khong qua lop dich. Cung tinh than
 * voi /api/don-video.
 *
 * Danh sach nay CHI con nhung thu lam ca goi vo nghia: thieu truong bat buoc,
 * hoac nhieu tep hon tran (mot goi 200 tep la mot goi sai, khong phai mot tin
 * co vai tep hong). MOT TEP HONG KHONG CON O DAY — xem `docGoiTin`.
 */
export type LoiGoiTin =
  | 'thieu-nguon-id'
  | 'thieu-ma-tin'
  | 'thieu-nguyen-van'
  | 'qua-nhieu-tep';

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
 * Doc goi tin tu than request. KHONG cham CSDL va khong decode tep — chi lam
 * sach va chan o cac tran; nguoi goi decode sau khi da qua day.
 *
 * Tra ve `{ loi }` thay vi nem: cua nhan phai phan biet duoc "goi hong" (400)
 * voi "tach bai hong" (van 201, luu ban goc — xem app/api/nhan-bai-zalo).
 *
 * MOT TEP LA KHONG DUOC LAM HONG CA TIN. Tep sai loai (.docx cua co), agent tu
 * khai qua 25MB hay thieu `url` thi BO RIENG tep do va ghi vao `bo_qua`; tin van
 * vao va bo me van co bai de duyet. Truoc day day tra 400 cho ca goi, ma
 * zalo-agent gui lai moi 30 phut nen mot to worksheet .docx dinh kem la KHOA
 * VINH VIEN tin giao bai do: khong co ban nhap, khong co muc cho duyet, khong
 * ai biet vi sao.
 *
 * `url` chi duoc kiem HINH DANG o day (co mat, khong qua dai). Kiem "tep nay co
 * phai cua kho minh khong" nam o lib/nhanBaiZalo.ts, vi no phai biet may chu da
 * bat Vercel Blob hay chua.
 */
export function docGoiTin(
  body: unknown
): { goi: GoiTinZalo } | { loi: LoiGoiTin } {
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
  const boQua: TepBoQua[] = [];
  for (const [i, t] of tho.entries()) {
    const o = (t ?? {}) as Record<string, unknown>;
    const loai = chuoi(o.loai, 120);
    // Tep tu Zalo hay KHONG CO TEN (bong bong video chi co key) — dat ten theo
    // thu tu de man bo me co gi de hien; duoi tep do loai quyet dinh.
    const ten = chuoi(o.ten, 200);
    const tenHien = tenHienTep(ten, i);
    if (!loaiTepZalo(loai)) {
      boQua.push({ ten: tenHien, ly_do: 'loai-khong-nhan', chi_tiet: loai || '?' });
      continue;
    }
    const url = chuoi(o.url, 2048);
    if (!url) {
      boQua.push({ ten: tenHien, ly_do: 'tep-hong' });
      continue;
    }
    // So agent khai chi de BAO TRUOC. Khai lo thi bo ngay o day cho re; khai
    // thieu thi khong an duoc gi — lib/nhanBaiZalo.ts hoi lai kho tep.
    const khai = Math.round(Number(o.kich_thuoc));
    const kichThuoc = Number.isFinite(khai) && khai > 0 ? khai : 0;
    if (kichThuoc > MAX_BYTES_MOI_TEP) {
      boQua.push({ ten: tenHien, ly_do: 'qua-nang', chi_tiet: String(kichThuoc) });
      continue;
    }
    dinhKem.push({
      ten,
      loai,
      kich_thuoc: kichThuoc,
      gui_luc: mocISO(o.gui_luc),
      url,
      thu_tu: i,
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
      ma_nhom: chuoi(b.ma_nhom, 64) || null,
      ngay_hoc_so: Number.isInteger(soNgayHoc) && soNgayHoc > 0 ? soNgayHoc : null,
      ngay_trong_tin: laNgayISO(b.ngay_trong_tin) ? b.ngay_trong_tin : null,
      nguyen_van: nguyenVan.slice(0, MAX_CHU_NGUYEN_VAN),
      dinh_kem: dinhKem,
      bo_qua: boQua,
      nhan_dien: docNhanDien(b.nhan_dien),
    },
  };
}

/**
 * Tep nay co nam trong CUA SO NHAN TEP cua nguon khong?
 *
 * Luat cua captain: chi lay tep DE BAI di kem tin, khong lay tep nhan xet tung
 * be. Hai loai do chi phan biet duoc bang THOI GIAN — do tren tin that: video
 * mau toi sau tin 4 giay, con tep nhan xet tung be toi sau ~4 tieng (migration
 * 021). `cua_so_dinh_kem_phut` cua nguon (mac dinh 90) la vach giua, va bo me
 * sua duoc no ngay tren man `/bome/zalo` — nen no phai duoc AP, khong phai mot
 * con so chi gui cho may o nha.
 *
 * Kiem o CA HAI phia va phai la MOT ham: cua phat ve tu choi 422 truoc khi agent
 * tai tep len, cua nhan tin bo rieng tep do vao `tep_bo_qua`.
 *
 * Ba bien, xu ly CO CHU DINH chu khong de roi tu nhien:
 *   - TIN khong co `gui_luc` (truong nullable, `mocISO` tra null khi hong): KHONG
 *     co moc de tinh cua so, nen BO QUA phep kiem va nhan tep. Dung bien "khong
 *     biet" thanh "bo het tep cua tin".
 *   - TEP khong co `gui_luc` ma tin thi co: khong doi chieu duoc -> 'thieu-gio-gui'.
 *   - TEP gui TRUOC tin: theo khoang [tin, tin + cua so] thi no nam ngoai, nen bi
 *     bo voi cung ly do 'ngoai-cua-so'. CO Y — mot tep co tu truoc khong phai tep
 *     cua bai nay.
 * Hai dau khoang tinh la TRONG cua so (tep toi dung giay cuoi cung van vao).
 */
export type KetQuaCuaSo = 'trong-cua-so' | 'ngoai-cua-so' | 'thieu-gio-gui';

export function kiemCuaSoDinhKem(
  tinGuiLuc: string | null,
  tepGuiLuc: string | null,
  cuaSoPhut: number
): KetQuaCuaSo {
  const moc = tinGuiLuc ? Date.parse(tinGuiLuc) : NaN;
  if (Number.isNaN(moc)) return 'trong-cua-so';
  const cua = tepGuiLuc ? Date.parse(tepGuiLuc) : NaN;
  if (Number.isNaN(cua)) return 'thieu-gio-gui';
  return cua >= moc && cua <= moc + cuaSoPhut * 60_000 ? 'trong-cua-so' : 'ngoai-cua-so';
}

/**
 * Cung phep so gio, o CUA VE — noi zalo-agent phai KHAI ca hai moc.
 *
 * Khac dung mot dieu, va no la dieu kien TIEN QUYET chu khong phai mot ban sao
 * cua luat gio: cua ve doi mot LOI KHAI DANH GIA DUOC. Thieu moc, hoac moc gui
 * len ma `Date.parse` khong doc duoc, deu la KHONG BIET tep co vao duoc khong —
 * va o day "khong biet" KHONG duoc phep thanh "cu phat ve": ve da ky la tep len
 * kho, roi cua nhan tin moi bo no, luc do khong dong `dinh_kem` nao tro toi, tuc
 * khong `han_xoa` va khong luot don nao thu hoi duoc, tren mot kho 1GB da dung
 * 219MB. Moc hong KHONG phai chuyen hiem: tham so di trong QUERY STRING, ma
 * `URLSearchParams` doi '+' cua mui gio thanh KHOANG TRANG — mot agent quen
 * percent-encode la moi moc deu thanh NaN.
 *
 * Phep so gio VAN la `kiemCuaSoDinhKem`, chi co MOT ban.
 *
 * HAI CUA LECH NHAU O DUNG CHO NAY LA CO Y, va lech ve phia AN TOAN — dung "sua
 * lai cho can":
 *   - Bat bien da chot la MOT CHIEU: ve 200 => cua nhan tin khong bo tep do vi
 *     ly do gio. Cua ve CHAT HON khong pha bat bien do.
 *   - `kiemCuaSoDinhKem` dung thu NaN LA CO CHU DINH cho cua nhan tin: tin khong
 *     co moc doc duoc thi khong co co so tinh cua so, nen van nhan tep. Bien
 *     "khong biet gio" thanh "bo het tep" o do la mat video cua co vi mot moc
 *     thoi gian hong.
 *   - Hong theo chieu nay: agent bi bao di sua loi khai roi moi tai duoc — khong
 *     sinh tep mo coi. Hong theo chieu kia (ve de hon cua nhan tin) moi dung la
 *     cai lo tep mo coi khong thu hoi duoc ma ca hang rao nay dung ra de bit.
 */
export function kiemCuaSoChoVe(
  tinGuiLuc: string,
  tepGuiLuc: string,
  cuaSoPhut: number
): KetQuaCuaSo {
  if (Number.isNaN(Date.parse(tinGuiLuc)) || Number.isNaN(Date.parse(tepGuiLuc))) {
    return 'thieu-gio-gui';
  }
  return kiemCuaSoDinhKem(tinGuiLuc, tepGuiLuc, cuaSoPhut);
}

// Ten tep tu Zalo la chuoi tu do (co giao dat), nen chi giu bo ky tu an toan
// va GOP moi day dau cham lai thanh mot: `/` da bi thay roi nhung de nguyen
// `..` trong mot doan duong dan la mot thu khong ai muon phai suy nghi lai.
const sachDoan = (s: string) =>
  s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[-.]+|[-.]+$/g, '') || 'tep';

/**
 * Duong dan nay co nam dung trong ho tep cua nguon nay khong?
 *
 * `zalo/<nguon>/<yyyy-mm-dd>/<mot doan ten>` (hop dong captain chot) — dung mot
 * doan cuoi, khong thu muc long nhau, va NGAY phai la ngay lich that: khong thi
 * `zalo/<nguon>/../..` hay mot cay thu muc do agent tu dat se lot qua. Tien to
 * `zalo/` la tien to RIENG, khong trung `nop-bai/` cua video con nop —
 * `laUrlVideoConNop` (lib/donVideo.ts) chi nhan `nop-bai/` nen mot luot don video
 * khong bao gio cham vao tep o day.
 *
 * btvn KHONG sinh duong dan — zalo-agent tu dat roi tai thang len kho. Day la
 * phia DUYET, va no duoc goi o HAI CHO phai giong nhau: cua phat ve (`POST
 * /api/nhan-bai-zalo/tep-token` chan pathname truoc khi ky) va cua nhan tin (doi
 * chieu `url` cua tung tep trong goi, qua `laUrlBlobZaloCuaNguon`). Lech nhau la
 * agent xin ve cho mot duong dan roi gui len mot duong dan khac.
 */
export function laDuongDanTepZalo(duongDan: unknown, nguonId: string): boolean {
  if (typeof duongDan !== 'string' || !duongDan) return false;
  const doan = duongDan.replace(/^\/+/, '').split('/');
  if (doan.length !== 4) return false;
  const [goc, nguon, ngay, ten] = doan;
  return goc === 'zalo' && nguon === sachDoan(nguonId) && laNgayISO(ngay) && ten.length > 0;
}

/**
 * URL nay co phai MOT TEP TREN KHO CUA APP MINH, dung ho cua nguon nay khong?
 *
 * Cua nhan khong co cookie va `url` do zalo-agent gui len, nen day la thu duy
 * nhat chan viec mot goi tro `url` sang chu khac: tep cua nha khac (`zalo/<nguon
 * khac>/`), video con nop (`nop-bai/`), hay mot dia chi ngoai ma trinh duyet cua
 * bo me se tai ve khi mo muc cho duyet. Cung tinh than voi `laUrlTepAppCap`
 * (lib/media.ts) o duong PATCH cua con: chot DANG URL vi khong chot duoc nguoi goi.
 */
export function laUrlBlobZaloCuaNguon(url: unknown, nguonId: string): boolean {
  if (typeof url !== 'string' || !url || url.length > 2048) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || !/(^|\.)blob\.vercel-storage\.com$/.test(u.hostname)) return false;
  let duongDan = u.pathname;
  try {
    duongDan = decodeURIComponent(duongDan);
  } catch {
    return false;
  }
  return laDuongDanTepZalo(duongDan, nguonId);
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
