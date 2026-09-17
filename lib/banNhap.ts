/**
 * Hai phep sua danh sach ban nhap cua man "Kiem tra lai": GOP mot the vao the
 * tren no, va TACH mot the lam hai tai con tro. Tach ra khoi KiemTraLai.tsx de
 * kiem duoc bang node --test (tep .tsx khong nap thang duoc, va hai phep nay
 * khong can DOM).
 *
 * Moi ban nhap mang mot MA rieng (`ma`) chi song tren may nay, khong len may
 * chu. Ma do la DANH TINH cua the: React dung lam `key`, va o de bai (textarea)
 * duoc cat theo ma chu khong theo chi so trong mang. Ly do: vi tri con tro
 * (`selectionStart`) nam o THE DOM, khong nam trong state. Danh so theo chi so
 * thi sau mot lan gop, the DOM cu duoc dung lai cho ban nhap KHAC ma van giu con
 * tro cu — bam "Tach bai nay" se cat mot the khac o cho bo me chua he cham vao.
 *
 * THOI LUONG o hai phep nay: sai theo huong THUA con hon sai theo huong THIEU.
 * Thieu la hong that — dong ho o man cua con reo giua chung va con mat +1 "xong
 * som" (lib/diem.ts) cho mot bai no lam dung han. Thua chi la dong ho con du gio.
 * Vi the GOP thi CONG hai so, con TACH thi CHEP nguyen so sang ca hai nua.
 *
 * So o day la so BO ME DANG GO, khong phai uoc luong may sinh ra, nen no di theo
 * tran cua CHINH O NHAP: sanitizeDuration, 180 phut. Tran 60 (DURATION_MAX,
 * clampDuration) chi ap cho uoc luong do AI / duong lui sinh ra — dung no o day
 * thi 45 + 30 ra 60, tuc la tu lam thieu dung thu nay muon tranh.
 */

import type { AttachedMedia, DraftAssignment } from './types';
import { DURATION_DEFAULT, sanitizeDuration } from './types';

/** Mot the o man Kiem tra lai. `durationStr` giu dang chuoi de bo me xoa trong o roi go so moi. */
export type BanNhap = DraftAssignment & { durationStr: string; ma: string };

let dem = 0;

/** Ma moi cho mot ban nhap. Chi can duy nhat trong MOT lan mo man hinh. */
export const maBanNhapMoi = (): string => `bn${++dem}`;

/**
 * Ghi chu cua bai gop: GIU CA HAI, ngan bang " · ". Ghi chu la cho ghi ten sach +
 * so trang (issue #64) — the gop om viec cua ca hai thi con phai biet ca hai quyen
 * ma lay ra, giu moi ghi chu cua the tren la mat han quyen kia. Hai ben trong thi
 * null; hai ben trung nhau thi chi mot lan.
 */
const gopGhiChu = (a: string | null, b: string | null): string | null => {
  const co = [a?.trim(), b?.trim()].filter((x): x is string => Boolean(x));
  return [...new Set(co)].join(' · ') || null;
};

/** So phut cua mot the; o trong / so hong = mac dinh, nhu luc luu (KiemTraLai). */
const phutCuaThe = (d: BanNhap): number => {
  const n = Number(d.durationStr);
  return Number.isFinite(n) && n > 0 ? n : DURATION_DEFAULT;
};

/**
 * Gop the thu `i` vao the ngay tren — AI hay tach nham mot bai thanh hai dong.
 * The con lai GIU NGUYEN ma cua no, nen con tro dang o the nao van thuoc the do.
 *
 * The gop mang DU thu cua ca hai the: de bai noi lai, ghi chu ghep (gopGhiChu),
 * tep dinh kem lay hop, co quay video la HOAC. Tu khi AI da tu gop cac dong cung
 * mot cuon, hai the bo me gop tay thuong la HAI CUON KHAC NHAU — bo mot ben la bo
 * han mot quyen con phai lay ra.
 *
 * Thoi luong CONG hai the roi kep bang sanitizeDuration (tran 180 cua chinh o
 * nhap): mot the om viec cua ca hai thi dong ho phai du gio cho ca hai. Tran do
 * cung khong duoc ha thap hon so bo me DA GO o mot trong hai the — ha xuong la
 * sai theo huong thieu.
 */
export function gopLenBanNhap(ds: BanNhap[], i: number): BanNhap[] {
  return ds.reduce<BanNhap[]>((acc, d, j) => {
    if (j === i && acc.length) {
      const prev = acc[acc.length - 1];
      // Tep dinh kem lay hop cua hai bai, khong nhan doi tep trung URL
      const media = [
        ...(prev.media ?? []),
        ...(d.media ?? []).filter((m) => !(prev.media ?? []).some((x) => x.url === m.url)),
      ];
      const phut = Math.max(
        sanitizeDuration(phutCuaThe(prev) + phutCuaThe(d)),
        phutCuaThe(prev),
        phutCuaThe(d),
      );
      acc[acc.length - 1] = {
        ...prev,
        content: `${prev.content} ${d.content}`.trim(),
        note: gopGhiChu(prev.note, d.note),
        durationStr: String(phut),
        media,
        // Mot trong hai nua co yeu cau quay video thi bai gop van phai quay
        requiresVideo: Boolean(prev.requiresVideo || d.requiresVideo),
      };
      return acc;
    }
    return [...acc, d];
  }, []);
}

/**
 * Tach the thu `i` lam hai — chieu nguoc cua "Gop voi bai tren", can tu khi AI
 * gop theo CUON SACH (issue #64): gop nham hai viec khac cuon vao mot the thi bo
 * me phai tach ra duoc bang tay.
 *
 * Cat tai `viTriConTro` neu con tro dang nam giua chu (bo me cham vao cho muon
 * cat roi bam nut); con tro o dau / cuoi / khong biet (null) thi the moi de trong
 * de bo me go. The moi CHEP mon, ghi chu (ten sach), giong doc, thoi luong va co
 * quay video cua the goc — hai nua thuong cung mot cuon / cung mot tin nhan; tep
 * dinh kem GIU o the goc, khong nhan doi. The moi luon mang MA MOI.
 *
 * Thoi luong CHEP nguyen sang ca hai nua, KHONG chia ti le: khong biet con tro
 * cat vao cho nao thi viec nang hay nhe, ma chep la sai theo huong THUA (mot
 * nua duoc du gio) — huong duy nhat duoc phep sai. Bo me sua lai so phut ngay o
 * dong do neu muon.
 */
export function tachBanNhap(ds: BanNhap[], i: number, viTriConTro: number | null): BanNhap[] {
  const d = ds[i];
  if (!d) return ds;
  const pos = viTriConTro ?? 0;
  const cat = pos > 0 && pos < d.content.length;
  const dau = cat ? d.content.slice(0, pos).trim() : d.content;
  const sau = cat ? d.content.slice(pos).trim() : '';
  const goc = { ...d, content: dau || d.content };
  const moi: BanNhap = { ...d, ma: maBanNhapMoi(), content: dau ? sau : '', media: [] };
  return [...ds.slice(0, i), goc, moi, ...ds.slice(i + 1)];
}

/** Vi tri cua ban nhap mang ma nay; -1 khi no khong con trong danh sach. */
export const viTriBanNhap = (ds: BanNhap[], ma: string): number => ds.findIndex((d) => d.ma === ma);

/**
 * Dinh mot tep vao the mang ma nay. Tra theo MA chu khong theo cho dung trong
 * mang: tai tep len la mot cho doi, ma trong luc doi bo me van bam Gop / Tach
 * duoc, nen cho so 3 luc bam khong con la cho so 3 luc tep len xong. The da bi
 * xoa (ma khong con) thi bo tep, khong dinh nham the khac.
 */
export function dinhTepVaoBanNhap(ds: BanNhap[], ma: string, tep: AttachedMedia): BanNhap[] {
  return ds.map((d) => (d.ma === ma ? { ...d, media: [...(d.media ?? []), tep] } : d));
}

/** Go mot tep khoi the mang ma nay — cung cach tra theo ma voi dinhTepVaoBanNhap. */
export function goTepKhoiBanNhap(ds: BanNhap[], ma: string, url: string): BanNhap[] {
  return ds.map((d) =>
    (d.ma === ma ? { ...d, media: (d.media ?? []).filter((m) => m.url !== url) } : d));
}
