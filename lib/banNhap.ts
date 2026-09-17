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
 */

import type { DraftAssignment } from './types';

/** Mot the o man Kiem tra lai. `durationStr` giu dang chuoi de bo me xoa trong o roi go so moi. */
export type BanNhap = DraftAssignment & { durationStr: string; ma: string };

let dem = 0;

/** Ma moi cho mot ban nhap. Chi can duy nhat trong MOT lan mo man hinh. */
export const maBanNhapMoi = (): string => `bn${++dem}`;

/**
 * Gop the thu `i` vao the ngay tren — AI hay tach nham mot bai thanh hai dong.
 * The con lai GIU NGUYEN ma cua no, nen con tro dang o the nao van thuoc the do.
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
      acc[acc.length - 1] = {
        ...prev,
        content: `${prev.content} ${d.content}`.trim(),
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
