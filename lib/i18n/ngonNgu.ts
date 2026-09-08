/**
 * Ngon ngu GIAO DIEN cua mot nha (issue #46) — thuoc tinh CUA NHA, khong cua may:
 * may nhap PIN nha nao thi hien chu cua nha do (cot families.ui_locale,
 * migrations/018). Mac dinh tieng Viet cho moi nha.
 *
 * Tep nay KHONG import gi de dung duoc o ca ba noi: component client (ban phim
 * PIN, man tao nha), server, va scripts/seed-demo.mjs.
 *
 * DUNG NHAM voi `Lang` trong lib/types.ts ('vi' | 'en'): do la ngon ngu cua DE
 * BAI (giong doc), khong phai giao dien.
 */

export const NGON_NGU = ['vi', 'en', 'ja', 'ko'] as const;
export type NgonNgu = (typeof NGON_NGU)[number];
export const NGON_NGU_MAC_DINH: NgonNgu = 'vi';

/** Loc gia tri la (DB, body) ve mot ngon ngu hop le — hong thi ve tieng Viet. */
export function ngonNguOf(v: unknown): NgonNgu {
  return typeof v === 'string' && (NGON_NGU as readonly string[]).includes(v)
    ? (v as NgonNgu)
    : NGON_NGU_MAC_DINH;
}

/**
 * Ba ma PIN DANH RIENG cho ba nha demo (captain dung de demo cho khach hang bang
 * cach NHAP PIN, khong co nut doi ngon ngu). Giu cho vinh vien: tao nha / doi PIN
 * trung mot trong ba ma nay bi tu choi ngay o man nhap (lib/auth.ts +
 * TaoNha.tsx), khong thi ban be dang ky trung roi gap loi "co nha khac dung".
 *
 * Ba nha nay do scripts/seed-demo.mjs tao/nap lai; du lieu trong do la du lieu
 * mau, KHONG phai du lieu that — vi PIN de doan nen nguoi la mo trung cung chi
 * thay du lieu mau (lib/nha-demo.test.ts kiem rang khong co duong nao tu nha
 * demo nhin sang nha khac).
 */
export const PIN_DEMO: Readonly<Record<string, NgonNgu>> = {
  '1111': 'ja',
  '2222': 'ko',
  '3333': 'en',
};

export const pinDanhRieng = (pin: string): boolean => pin in PIN_DEMO;

