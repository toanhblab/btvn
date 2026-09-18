/**
 * Luat tinh diem cho cac con — HAM THUAN, khong SQL, khong import lib/db.ts.
 *
 * Tach khoi lib/store.ts de test duoc bang `node --test` (lib/diem.test.ts):
 * store.ts dung import khong duoi (`from './db'`) ma node khong resolve duoc
 * khi nap thang tep .ts (xem tsconfig.json va chu thich dau lib/ngay.ts).
 * store.ts goi cac ham nay o ghiDiemSauKhiXong; phan SQL (unique index "cong
 * mot lan", so du) kiem tren PGlite that o lib/tinh-diem.test.ts.
 *
 * Luat captain chot (migrations/015_tinh_diem_doi_thuong.sql):
 *
 *   +DIEM_NGAY_XONG  mot NGAY xong het — ca bai tap lan viec nha cua ngay do,
 *                    dung cong thuc "hom nay da xong" sau issue #36. Cong MOT
 *                    LAN cho moi (con, ngay), khong cong le theo tung bai.
 *   +DIEM_XONG_SOM   moi BAI xong SOM hon thoi luong du kien cua chinh bai do
 *                    ("1 bai co 5' de lam nhung hoan thanh trong 4' se duoc
 *                    thuong" — captain). Khong phai som so voi han nop.
 *   Khong hoi to     ngay (due_date) truoc families.score_since khong tinh.
 *
 * Do "lam trong bao lau" bang MOC CON BAM "BAT DAU LAM" cua dong ho dem nguoc
 * da co san (app/con/[childId]/bai/[id]/DongHoLamBai.tsx): may con gui moc do
 * len kem luc tick xong, may chu tru voi gio hien tai. Chon cach nay vi:
 *
 *   - Con MO bai roi di choi khong bi mat thuong oan: dong ho chi chay khi con
 *     chu dong bam "Bat dau lam", mo trang ra xem khong tinh gio.
 *   - Con lam ra giay truoc roi vao tick: KHONG co moc bat dau -> khong thuong.
 *     Muon thuong thi phai bam dong ho — dung y "lam trong N phut".
 *   - Con bam nham thi da co "Bo me dat lai gio" (DatLaiGio.tsx) xoa moc.
 *   - Cung mot moc voi cau khen "Con lam xong som luon!" + confetti da co o
 *     ChiTietBai.tsx, nen con thay confetti la GAN NHU luon duoc +1. Hai ben
 *     KHONG cung mot phep so sanh: loi khen do may con tu quyet (moc trong
 *     localStorage, gio may con, so sanh luc nhan tra loi), con +1 do may chu
 *     quyet va con doi thi ngay khong hoi to (ngayDuocTinhDiem) + do tre mang.
 *     Nen co the lech o BIEN: bai cua ngay truoc score_since, hoac tick sat
 *     giay cuoi cua dong ho — con duoc khen ma khong co chip +1.
 *
 * Gioi han NOI RO: may chu tin moc bat dau do may con bao (app gia dinh, khong
 * chong gian lan). Con bam "Bat dau lam" roi tick ngay cung duoc +1; moc do
 * luu lai o assignments.started_at lam bang chung cua phep so sanh. Viec nha
 * (chore_id khong null) khong co dong ho nen khong bao gio duoc +1.
 */

export const DIEM_NGAY_XONG = 10;
export const DIEM_XONG_SOM = 1;

/**
 * Ngay (due_date, YYYY-MM-DD) nay co duoc tinh diem khong — khong hoi to:
 * chi tu ngay bat dau tinh diem cua nha (families.score_since) tro di.
 */
export function ngayDuocTinhDiem(dueDate: string, scoreSince: string): boolean {
  return dueDate >= scoreSince;
}

/**
 * Ngay da HOAN THANH chua: moi dong cua (con, ngay) — ca bai tap that lan viec
 * nha — deu 'done', VA co it nhat mot bai tap that (chore_id null). Khong co
 * bai that thi khong tinh: bo me xoa het bai cua ngay do ma dong viec nha con
 * lai da tick het thi khong phai la "lam xong bai tap".
 */
export function ngayHoanThanh(rows: { status: string; choreId: string | null }[]): boolean {
  return rows.some((r) => r.choreId === null) && rows.every((r) => r.status === 'done');
}

/**
 * Xong som: co moc bat dau, va (luc xong - luc bat dau) NHO HON thoi luong.
 * Dung bang thoi luong thi khong som (5' cho bai 5' la vua kip, khong thuong).
 */
export function xongSom(
  startedAtMs: number | null,
  completedAtMs: number,
  durationMinutes: number
): boolean {
  if (startedAtMs === null) return false;
  const elapsed = completedAtMs - startedAtMs;
  return elapsed >= 0 && elapsed < durationMinutes * 60_000;
}

/**
 * LOC moc bat dau do may con gui len (JSON body, kieu unknown): phai la
 * so epoch ms huu han, duong, va KHONG o tuong lai (dong ho may con lech nhieu
 * hay du lieu bay thi bo qua, coi nhu khong bam) — tra null neu khong dung.
 */
export function locMocBatDau(v: unknown, nowMs: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > nowMs) return null;
  return Math.floor(n);
}

/**
 * Xep hang cac con theo diem, cao nhat truoc; bang diem thi CUNG HANG (hai con
 * 30 diem deu hang 1, con tiep theo hang 3) va giu nguyen thu tu dau vao
 * (sort_order cua nha) de hai anh chi em bang diem khong doi cho nhau moi lan
 * tai trang. Tra ve danh sach moi, khong sua danh sach dau vao.
 */
export function xepHang<T extends { points: number }>(list: T[]): (T & { rank: number })[] {
  // Array.prototype.sort on dinh (ES2019) nen phan tu bang diem giu thu tu cu.
  const sorted = [...list].sort((a, b) => b.points - a.points);
  // Hang = vi tri cua con DAU TIEN co cung so diem + 1 (1-2-2-4, kieu "standard
  // competition ranking").
  return sorted.map((c) => ({ ...c, rank: sorted.findIndex((x) => x.points === c.points) + 1 }));
}

/**
 * Ti le thoi luong con phai lam truoc khi duoc bam "Da lam xong" (issue #72).
 *
 * Truoc day con bam "Bat dau lam" xong la tick xong duoc ngay — bai 10 phut
 * xong trong 2 giay, van an +1 "xong som". Gio phai troi qua it nhat mot NUA
 * thoi luong cua chinh bai do. Khoang 50%-100% van la "xong som" (xongSom o
 * tren), nen luat thuong cu khong doi: cua so an +1 chi hep lai con nua sau.
 */
export const TI_LE_TOI_THIEU_DE_XONG = 0.5;

/**
 * Con phai cho them BAO NHIEU GIAY nua moi duoc bam "Da lam xong"; 0 = bam duoc.
 *
 * Dung DUNG mot moc voi luat "xong som": moc con bam "Bat dau lam"
 * (DongHoLamBai.tsx -> startedAt -> assignments.started_at). Nen han che cung
 * y het: moc do do MAY CON gui len nen hang rao nay chan bam nham va bam voi,
 * khong chan duoc nguoi co tinh sua — chap nhan, vi +1 xong som cung tin cung
 * mot moc.
 *
 * `startedAtMs === null` (con chua bam "Bat dau lam", hoac bai khong co dong ho
 * nhu dong nhiem vu hang ngay) -> 0: GIU NGUYEN hanh vi cu, khong khoa gi.
 */
export function giayConPhaiCho(
  startedAtMs: number | null,
  nowMs: number,
  durationMinutes: number
): number {
  if (startedAtMs === null) return 0;
  const canMs = durationMinutes * 60_000 * TI_LE_TOI_THIEU_DE_XONG;
  return Math.max(0, Math.ceil((startedAtMs + canMs - nowMs) / 1000));
}
