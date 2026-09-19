/**
 * Mui gio nha va cach lay NGAY (YYYY-MM-DD) theo mui gio do — MOT ban duy nhat
 * cho moi cho ma "hom nay" cua app duoc quyet dinh: `todayISO()` (lib/store.ts)
 * va hai script seed (scripts/seed.mjs, scripts/seed-demo.mjs).
 *
 * Vi sao khong dung dong ho cua may chay (`new Date()` + `getDate()`): man cua
 * con, man cua bo me va `taoNhiemVuNgay` deu chay o ham Vercel voi TZ=UTC, con
 * nha o +07. Tu 00:00 den 07:00 sang gio nha, "hom nay" theo dong ho may chu van
 * la HOM QUA — bai da xong hom qua hien duoi nhan "Hôm nay" tren iPad cua con,
 * bai cua hom nay that bi coi la "ngay mai" nen bi cat, va nhiem vu hang ngay
 * duoc tao cho ngay sai (issue #75). May dev chay +07 nen khong lo; test ghim o
 * lib/man-con-mui-gio.test.ts chay man cua con trong tien trinh node co TZ khac.
 *
 * Dat `TZ=Asia/Ho_Chi_Minh` tren Vercel cung che duoc, nhung ma phai dung du
 * chay o mui gio nao — nen ma khong dua vao bien do.
 *
 * Tep nay CO Y khong import gi (ke ca lib/ngay.ts, vi ngay.ts keo lib/i18n/chu
 * khong duoi ma node thuong khong resolve duoc): hai script .mjs nap no bang
 * import() truc tiep, khong qua hook cua npm test.
 */

/**
 * Mui gio nha — cung dung cho moi cho in moc thoi gian lay tu DB
 * (score_penalties.created_at, reward_redemptions.decided_at, gio nop video...);
 * xem `ngayNha` trong lib/ngay.ts.
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

/** Ba so nam/thang/ngay cua mot moc, theo mui gio nha (thang/ngay co so 0 dan dau). */
export function soNgayNha(moc: Date): { year: string; month: string; day: string } {
  const p: Record<string, string> = {};
  for (const { type, value } of SO_NGAY_NHA.formatToParts(moc)) p[type] = value;
  return { year: p.year, month: p.month, day: p.day };
}

/**
 * Ngay YYYY-MM-DD theo mui gio nha cua mot moc (mac dinh: bay gio), lech
 * `offsetDays` ngay. Cong/tru ngay lam tren lich UTC cua chuoi da tinh — khong
 * dung `setDate` tren Date gio dia phuong cua may chu, vi dua ve dong ho may chu
 * la lai dua vao mui gio cua no.
 */
export function ngayNhaISO(moc: Date = new Date(), offsetDays = 0): string {
  const { year, month, day } = soNgayNha(moc);
  if (offsetDays === 0) return `${year}-${month}-${day}`;
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + offsetDays));
  return d.toISOString().slice(0, 10);
}
