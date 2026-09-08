/**
 * Lop dich chu cua app (issue #46) — MOT ham `T(key, tham?)`.
 *
 * KHOA la CHINH CAU TIENG VIET trong ma nguon: `T('Hôm nay con là ai?')`. Tieng
 * Viet la ban goc nen khong can tu dien; ba tu dien en/ja/ko anh xa cau Viet ->
 * cau dich. Chon cach nay vi day la app gia dinh: khong phai dat ten khoa cho
 * ~600 cau, doc ma vẫn thay chu that, va TypeScript kiem duoc — `Key` la hop
 * cac khoa cua EN (lib/i18n/en.ts), nen goi `T('cau chua co')` la loi bien dich,
 * va JA/KO khai bao `Record<Key, string>` nen thieu mot cau cung loi bien dich.
 *
 * Tham so: `{n}` trong cau — `T('Còn {n} việc', { n: 3 })`. Khong xu ly so
 * nhieu: muc do can cho demo (captain chot), khong phai san pham ban dia hoa.
 *
 * Tep nay KHONG dung cookie/DB nen chay o ca client lan server:
 *   - server component / route:  `const T = await chu()`   (lib/i18n/server.ts)
 *   - client component:          `const T = useT()`        (lib/i18n/client.tsx)
 *   - ham thuan can dich:        nhan `T` lam tham so, mac dinh `taoT('vi')`.
 *
 * Chu BO ME TU GO (de bai, ten nhiem vu, ten phan thuong) KHONG di qua day —
 * chi chu cua app. Buoc quet ma nguon `npm run quet:chu-viet`
 * (scripts/quet-chu-viet.mjs) bao dam khong con cau tieng Viet nao nam ngoai
 * `T(...)`; `lib/i18n.test.ts` giu phan hanh vi cua lop dich.
 */

import { EN, type Key } from './en';
import { JA } from './ja';
import { KO } from './ko';
import { NGON_NGU_MAC_DINH, type NgonNgu } from './ngonNgu';

export type { Key };
export type Tham = Record<string, string | number>;
export type T = (key: Key, tham?: Tham) => string;

export const TU_DIEN: Record<Exclude<NgonNgu, 'vi'>, Record<Key, string>> = { en: EN, ja: JA, ko: KO };

/** Dien `{ten}` trong mau bang gia tri; cho khong co gia tri thi giu nguyen. */
export function dienTham(mau: string, tham?: Tham): string {
  if (!tham) return mau;
  return mau.replace(/\{(\w+)\}/g, (nguyen, k: string) => (k in tham ? String(tham[k]) : nguyen));
}

export function dich(ngonNgu: NgonNgu, key: Key, tham?: Tham): string {
  const mau = ngonNgu === 'vi' ? key : (TU_DIEN[ngonNgu][key] ?? key);
  return dienTham(mau, tham);
}

export function taoT(ngonNgu: NgonNgu): T {
  return (key, tham) => dich(ngonNgu, key, tham);
}

/** T cua ban goc — cho ham thuan / test khong co ngu canh nha. */
export const T_VI: T = taoT(NGON_NGU_MAC_DINH);
