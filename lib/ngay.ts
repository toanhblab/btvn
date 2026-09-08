/**
 * Tien ich ngay dung chung cho cac man theo NGAY (nop bai cho co, chon ngay
 * nop lai...). Tach ra tu app/bome/(khung)/nop-co/page.tsx (issue #26) de man
 * "Chon ngay nop bai" (issue #31) dung chung, khong chep lai mot ban khac de
 * roi lech nhau dan.
 */

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

const THU = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** "2026-09-02" -> "Thứ Ba, 2/9". */
export function ngayTiengViet(ngay: string): string {
  const d = tuISO(ngay);
  return `${THU[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
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
 * Mui gio nha — MOT ban duy nhat cho moi cho in moc thoi gian lay tu DB
 * (score_penalties.created_at, reward_redemptions.decided_at, gio nop video...).
 *
 * Cac man do la force-dynamic nen chuoi duoc dung o HAM Vercel (TZ=UTC) roi
 * hydrate lai o may bo me / iPad (+07). Khong chot mui gio thi lan tru luc 06:30
 * sang 9/9 gio nha (23:30Z ngay 8/9) hien ra "8/9/2026": con doc thanh bi tru tu
 * hom qua, va moi lan tru trong khoang 00:00-07:00 deu lech mot ngay. Khong lo
 * ra o may dev vi may o day chay dung +07.
 */
export const MUI_GIO_NHA = 'Asia/Ho_Chi_Minh';

/**
 * Chi lay TUNG SO roi tu ghep theo khuon cua minh: toLocaleDateString('vi-VN')
 * con lay thu tu va dau phan cach tu ban CLDR cua chinh may chay nen may chu va
 * iPad ra hai chuoi khac nhau cho cung mot moc (chu thich day du o
 * app/bome/(khung)/bai/[id]/SuaBai.tsx, cho hien GIO nop video).
 */
const SO_NGAY_NHA = new Intl.DateTimeFormat('en-US', {
  timeZone: MUI_GIO_NHA, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Moc ISO tu DB -> "9/9/2026" theo mui gio nha (khong so 0 dan dau, nhu vi-VN). */
export function ngayNha(iso: string): string {
  const p: Record<string, string> = {};
  for (const { type, value } of SO_NGAY_NHA.formatToParts(new Date(iso))) p[type] = value;
  return `${Number(p.day)}/${Number(p.month)}/${p.year}`;
}
