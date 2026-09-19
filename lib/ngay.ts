/**
 * Tien ich ngay dung chung cho cac man theo NGAY (nop bai cho co, chon ngay
 * nop lai...). Tach ra tu app/bome/(khung)/nop-co/page.tsx (issue #26) de man
 * "Chon ngay nop bai" (issue #31) dung chung, khong chep lai mot ban khac de
 * roi lech nhau dan.
 */

import { T_VI, type Key, type T as TDich } from './i18n/chu';
import { soNgayNha } from './muiGio';

/** YYYY-MM-DD -> Date GIO DIA PHUONG. new Date('2026-09-02') la nua dem UTC nen
    o mui gio am se lui mat mot ngay — tach tay cho chac. */
export function tuISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sangISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function lechNgay(ngay: string, n: number): string {
  const d = tuISO(ngay);
  d.setDate(d.getDate() + n);
  return sangISO(d);
}

/** Ten thu theo getDay() — la KHOA dich (lib/i18n), noi hien phai boc `T(...)`. */
export const THU = [
  'Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy',
] as const satisfies readonly Key[];

/**
 * "2026-09-02" -> "Thứ Ba, 2/9" (theo ngon ngu cua T; mac dinh tieng Viet).
 * Khuon ngay/thang giu nguyen o moi ngon ngu — muc do can cho demo (issue #46).
 */
export function ngayTiengViet(ngay: string, T: TDich = T_VI): string {
  const d = tuISO(ngay);
  return `${T(THU[d.getDay()])}, ${d.getDate()}/${d.getMonth() + 1}`;
}

/** Cua so tim "ngay gan nhat co bai" (issue #31) — du rong cho ky nghi he/Tet
    ma van khong phai quet ca lich su cua nha da dung app lau. */
export const SO_NGAY_QUET_GAN_DAY = 120;

/**
 * Loc con N ngay GAN NHAT (<= mocNgay) THAT SU co bai, tu mot danh sach due_date
 * (co the trung lap, khong theo thu tu) — dung cho man "Chon ngay nop bai"
 * (issue #31): nut nop bai cua lop tieng Anh chi hien cho HOM NAY nen sang ngay
 * moi ma hom do khong giao bai la bo me mat luon loi vao. Man do can 3 ngay GAN
 * NHAT CO BAI, khong phai 3 ngay lien tiep truoc hom nay (co the nghi le, nghi
 * cuoi tuan xen giua) nen KHONG the tinh bang mocNgay - 1, mocNgay - 2.
 *
 * Ham thuan, khong dung SQL: goi voi due_date lay tu listAssignments (da loc
 * san theo nguon/khoang ngay) — tach khoi store.ts de test duoc bang node --test
 * ma khong keo theo lib/db.ts (import extensionless, khong resolve duoc khi
 * node nap thang tep .ts, chi Next moi resolve duoc).
 */
export function ngayGanNhatCoBai(dueDates: string[], mocNgay: string, limit = 3): string[] {
  const daXem = new Set<string>();
  for (const d of dueDates) if (d <= mocNgay) daXem.add(d);
  return [...daXem].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, limit);
}

/**
 * Mui gio nha — dinh nghia o lib/muiGio.ts (tep khong import gi, de hai script
 * seed .mjs cung nap duoc); re-export o day vi cac man in NGAY va SuaBai.tsx
 * van import tu lib/ngay.
 *
 * Cac man do la force-dynamic nen chuoi duoc dung o HAM Vercel (TZ=UTC) roi
 * hydrate lai o may bo me / iPad (+07). Khong chot mui gio thi lan tru luc 06:30
 * sang 9/9 gio nha (23:30Z ngay 8/9) hien ra "8/9/2026": con doc thanh bi tru tu
 * hom qua, va moi lan tru trong khoang 00:00-07:00 deu lech mot ngay. Khong lo
 * ra o may dev vi may o day chay dung +07. Cung mot lop loi do voi "hom nay" cua
 * app (`todayISO`, issue #75) — xem chu thich dau lib/muiGio.ts.
 */
export { MUI_GIO_NHA, ngayNhaISO } from './muiGio';

/** Moc ISO tu DB -> "9/9/2026" theo mui gio nha (khong so 0 dan dau, nhu vi-VN). */
export function ngayNha(iso: string): string {
  const p = soNgayNha(new Date(iso));
  return `${Number(p.day)}/${Number(p.month)}/${p.year}`;
}
