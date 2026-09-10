/** Kieu du lieu dung chung — bam theo PRD muc 7. */

import { TU_DIEN, T_VI, type Key, type T } from './i18n/chu';

/**
 * Cac NHAN trong tep nay (HW_SOURCES, SUBJECTS, NHOM_NHIEM_VU, LY_DO_TRU_*) la
 * KHOA dich (lib/i18n/chu.ts): gia tri tieng Viet giu nguyen — nha that cua
 * captain van doc "Nguyễn Siêu" / "Smartkid" — con noi hien boc `T(nhan)` de nha
 * demo thay ban dich. Ma dinh danh trong DB khong doi.
 */

export type Lang = 'vi' | 'en';
export type Status = 'todo' | 'done';

/** Mau rieng cua tung con. Hai be sinh doi phai khac mau vi chua doc thao ten. */
export type ChildColor = 'primary' | 'secondary' | 'tertiary';

/**
 * Noi giao bai: truong Nguyen Sieu, lop tieng Anh Smartkid, hay mot noi khac.
 * Con can moi noi mot nhom rieng de lam xong het mot loai roi moi sang loai kia.
 * Them nguon moi (lop ve, lop nhac...) thi noi vao day + HW_SOURCES, DB khong co
 * CHECK nen khong can migration.
 *
 * MA DINH DANH trong DB la co dinh ('primary_school', 'english_class', 'other') —
 * doi nhan hien thi thi chi sua HW_SOURCES, dung sua ma, khong thi du lieu cu mat
 * nguon.
 */
export type HwSource = 'primary_school' | 'english_class' | 'other';

/** Nhan + icon tung nguon. Thu tu khoa = thu tu hien o man cua con. */
export const HW_SOURCES: Record<HwSource, { label: Key; icon: string }> = {
  primary_school: { label: 'Nguyễn Siêu', icon: '🏫' },
  english_class: { label: 'Smartkid', icon: '🇬🇧' },
  other: { label: 'Khác', icon: '📚' },
};

/** Tap khoa THAT cua HW_SOURCES — them nguon thu tu la hwSourceOf tu biet. */
const HW_SOURCE_KEYS = new Set<string>(Object.keys(HW_SOURCES));

/**
 * Dich degrade khi gia tri khong doc duoc. CHOT CUNG, co y KHONG lay theo thu tu
 * khoa cua HW_SOURCES: thu tu do thuan hien thi (nhom nao truoc o man cua con) va
 * duoc phep doi tu do, khong duoc keo theo mot quyet dinh ngu nghia. Cac noi khac
 * tu ghi mac dinh (KiemTraLai, NhapTay, ThemBaiTap, api/extract) deu import chinh
 * hang so nay, dung viet lai literal — de doi mot cho la doi het.
 */
export const HW_SOURCE_DEFAULT: HwSource = 'primary_school';

/**
 * Loc gia tri la tu ngoai vao (API body, sessionStorage cu) ve mot nguon hop le.
 *
 * Kiem tra THANH VIEN doi chieu voi TAP KHOA THAT cua HW_SOURCES chu khong viet
 * cung tung ten — truoc day ham nay nhi phan ("khong phai english_class thi la
 * primary_school") nen nguon moi bi nuot am tham luc doc lai tu DB. Them nguon
 * thu tu vao HW_SOURCES la ham tu nhan, khong phai so lai.
 *
 * Gia tri la KHONG nem loi: API cu / ban nhap cu van chay duoc, chi degrade ve
 * nguon mac dinh.
 */
/**
 * Bai nay dang o dau trong chuyen "con quay video nop lai"?
 *
 * BA trang thai chu khong hai, va cho thu ba la viec don video (lib/donVideo.ts):
 * no go `submittedVideoUrl` nhung GIU `submittedVideoAt`, nen "con chua quay bao
 * gio" va "con quay roi, video cu da don" khac nhau o dung mot cho do. Doc moi
 * `submittedVideoUrl` la gop hai cai lam mot, va man hinh se noi voi bo me rang
 * con chua quay mot bai con da nop xong tu tuan truoc.
 *
 * Moi man doc trang thai video PHAI di qua ham nay — hai man cua "Nop bai cho co"
 * (danh sach video va o dem "{done}/{total} video da quay") va the 🎥 o man chi
 * tiet con deu tra loi cung mot cau hoi, nen chung khong duoc tu viet lay dieu
 * kien rieng.
 */
export type TrangThaiVideo = 'chua-quay' | 'da-nop' | 'da-don';

export function trangThaiVideo(
  a: { submittedVideoUrl: string | null; submittedVideoAt: string | null }
): TrangThaiVideo {
  if (a.submittedVideoUrl) return 'da-nop';
  return a.submittedVideoAt ? 'da-don' : 'chua-quay';
}

export function hwSourceOf(v: unknown): HwSource {
  return typeof v === 'string' && HW_SOURCE_KEYS.has(v) ? (v as HwSource) : HW_SOURCE_DEFAULT;
}

export interface Child {
  id: string;
  familyId: string;
  name: string;
  color: ChildColor;
  avatarUrl: string;
  grade: string | null;
  sortOrder: number;
}

/** Loai tep dinh kem — quyet dinh trinh phat nao hien o man cua con. */
export type MediaKind = 'video' | 'audio' | 'image';

/**
 * Tep bo me dinh kem vao bai: video luyen phat am, ghi am mau doc cua co,
 * anh bang chu cai...
 */
export interface AttachedMedia {
  url: string;
  /** Ten tep goc, de bo me phan biet cac tep voi nhau khi gan vao bai. */
  name: string;
  kind: MediaKind;
}

export interface Assignment {
  id: string;
  submissionId: string | null;
  childId: string;
  subject: string;
  icon: string;
  content: string;
  note: string | null;
  lang: Lang;
  dueDate: string;          // YYYY-MM-DD
  /** Noi giao bai — chon luc nhap, sua duoc sau khi giao. */
  source: HwSource;
  status: Status;
  completedAt: string | null;
  imageUrl: string | null;
  media: AttachedMedia[];
  /** Thoi luong lam bai (phut) — dong ho dem nguoc o man cua con chay tu so nay. */
  durationMinutes: number;
  /** Bai nay phai QUAY VIDEO nop lai (doc to, doc thuoc long, quay gui co...). */
  requiresVideo: boolean;
  /** Video con da nop — moi bai giu mot video moi nhat, quay lai la thay. */
  submittedVideoUrl: string | null;
  submittedVideoAt: string | null;
  /**
   * Dong nay co phai mot "viec nha" (nhiem vu mac dinh, issue #25/#36) khong —
   * tham chieu daily_chores.id, null neu la bai tap that. DAU HIEU DUY NHAT de
   * phan biet: co y KHONG them 'viec nha' vao HW_SOURCES o tren — hang so do bi
   * lap lai o 4 man nhap/sua bai cua bo me de ve nut "chon noi giao", them vao
   * do se hien mot nut co the bam nham cho mot bai THAT.
   */
  choreId: string | null;
  /**
   * Moc con bam "Bat dau lam" (dong ho dem nguoc), do may con gui len luc tick
   * xong — de xet "xong som" (+1 diem, lib/diem.ts) va luu lai lam bang chung
   * cua phep so sanh do. null = con khong bam dong ho / bai chua xong.
   */
  startedAt: string | null;
  /**
   * So sao cua dong NHIEM VU nay (chep tu daily_chores.stars luc tao dong, issue
   * #42). null = bai tap that, HOAC dong viec nha cu tao truoc migration 016 —
   * dong null khong bao gio duoc cong sao (khong hoi to).
   */
  stars: number | null;
  /**
   * Nhom cua nhiem vu (doc LIVE qua JOIN daily_chores, nhu sort_order — xem
   * listAssignments). null = bai tap that. Dong viec nha ma daily_chores khong
   * con (chore_id ve NULL) thi cung la null — luc do no da la bai that.
   */
  choreNhom: NhomNhiemVu | null;
}

/** Mot bai do AI tach ra, chua luu — bo me con phai duyet o man "Kiem tra lai". */
export interface DraftAssignment {
  subject: string;
  icon: string;
  content: string;
  note: string | null;
  lang: Lang;
  /**
   * Do tin cua NGUON tach bai, khong phai AI tu cham diem:
   *   1    -> AI doc (lib/ai.ts)
   *   0.3  -> tach tho theo dong khi khong goi duoc AI (splitByRule)
   * Duoi 0.6 thi man Kiem tra lai gan co canh bao cho tung bai.
   */
  confidence: number;
  /** Tep dinh kem cho bai nay. Optional vi ban nhap cu trong sessionStorage khong co. */
  media?: AttachedMedia[];
  /** Thoi luong (phut). Optional vi ban nhap cu trong sessionStorage khong co -> mac dinh 10. */
  durationMinutes?: number;
  /** Bai nay can quay video nop lai. Optional cung ly do voi media. */
  requiresVideo?: boolean;
}

/* ---------------- Thoi luong lam bai ----------------
 *
 * AI uoc luong theo do phuc tap nhung bi KEP trong [MIN, MAX] — LLM doi khi
 * phong dai ("bai kho, 45 phut") trong khi tre 4-6 tuoi khong ngoi qua 15 phut.
 * Bo me sua tay thi chi can so duong hop ly, duoc phep ra ngoai khoang cua AI.
 */

export const DURATION_MIN = 5;
export const DURATION_MAX = 15;
export const DURATION_DEFAULT = 10;

/** Kep uoc luong cua AI vao [5, 15]; gia tri hong -> mac dinh 10. */
export function clampDuration(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return DURATION_DEFAULT;
  return Math.min(DURATION_MAX, Math.max(DURATION_MIN, n));
}

/** Lam sach gia tri bo me nhap: so nguyen duong, toi da 3 tieng cho khoi go nham. */
export function sanitizeDuration(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return DURATION_DEFAULT;
  return Math.min(n, 180);
}

/**
 * Danh sach mon co dinh + icon. PRD muc 12 con de mo, tam chot ngan gon.
 * Khoa la ten mon TIENG VIET (dong thoi la khoa dich) — ten mon LUU VAO DB la
 * chu bo me nhin thay luc chon, nen nha demo luu ban dich (xem `subjectsFor`).
 */
export const SUBJECTS = {
  'Toán': '🔢',
  'Tiếng Việt': '📖',
  'Tiếng Anh': '🔤',
  'Vẽ': '🎨',
  'Tự nhiên': '🐝',
  'Khác': '📝',
} satisfies Partial<Record<Key, string>>;

type TenMon = keyof typeof SUBJECTS;
const SUBJECT_KEYS = Object.keys(SUBJECTS) as TenMon[];

/** Danh sach mon theo ngon ngu cua nha: { ten hien thi (= ten luu DB) -> icon }. */
export function subjectsFor(T: T = T_VI): Record<string, string> {
  return Object.fromEntries(SUBJECT_KEYS.map((k) => [T(k), SUBJECTS[k]]));
}

/**
 * Icon cua mon — nhan ten mon o BAT KY ngon ngu nao (ten luu trong DB cua nha
 * demo la ban dich), khong khop thi icon cua "Khác".
 */
const ICON_THEO_TEN_MON: Record<string, string> = Object.fromEntries([
  ...SUBJECT_KEYS.map((k) => [k, SUBJECTS[k]]),
  ...Object.values(TU_DIEN).flatMap((td) => SUBJECT_KEYS.map((k) => [td[k], SUBJECTS[k]])),
]);

export function iconFor(subject: string): string {
  return ICON_THEO_TEN_MON[subject] ?? SUBJECTS['Khác'];
}

/* ---------------- Nhiem vu hang ngay ("viec nha") ----------------
 *
 * MOT danh sach chung ca nha (issue #25), bo me sua o man rieng
 * /bome/nhiem-vu-hang-ngay (issue #42). Moi nhiem vu dang bat sinh ra mot DONG
 * assignments that cho moi (con duoc giao, ngay) — tao luoi khi mo man, moi
 * ngay ke ca ngay khong co bai (taoNhiemVuNgay trong lib/store.ts).
 *
 * HAI NHOM (captain chot o #42, Q1): "Sau khi hoc xong" (don dep, chuan bi do
 * dung — ba viec mac dinh thuoc nhom nay) va "Viec nha hang ngay" (viec nha cua
 * con). Man cua con hien hai nhom rieng, khong tron. MA trong DB co dinh
 * ('after_study' / 'housework', CHECK o migrations/016) — doi nhan hien thi thi
 * chi sua NHOM_NHIEM_VU, dung sua ma.
 */

export type NhomNhiemVu = 'after_study' | 'housework';

/** Nhan + icon tung nhom. Thu tu khoa = thu tu hai nhom hien o man cua con. */
export const NHOM_NHIEM_VU: Record<NhomNhiemVu, { label: Key; icon: string; moTa: Key }> = {
  after_study: {
    label: 'Sau khi học xong',
    icon: '🎒',
    moTa: 'Dọn dẹp, chuẩn bị đồ dùng sau buổi học',
  },
  housework: {
    label: 'Việc nhà hàng ngày',
    icon: '🏠',
    moTa: 'Việc nhà của con, ngày nào cũng làm',
  },
};

export const NHOM_NHIEM_VU_MAC_DINH: NhomNhiemVu = 'after_study';

/** Loc gia tri la (API body, DB) ve mot nhom hop le — hong thi ve nhom mac dinh. */
export function nhomNhiemVuOf(v: unknown): NhomNhiemVu {
  return v === 'housework' ? 'housework' : NHOM_NHIEM_VU_MAC_DINH;
}

export interface DailyChore {
  id: string;
  content: string;
  /** Mot emoji — con chua doc duoc chu nen icon la thu con nhan ra truoc. */
  icon: string;
  /** So sao con duoc khi tick xong, 1..MAX_SAO_NHIEM_VU. */
  stars: number;
  nhom: NhomNhiemVu;
  /** Giao cho con nao: null = CA NHA (con them sau tu duoc nhan), hoac danh sach id con. */
  childIds: string[] | null;
  sortOrder: number;
  /** Tat thi khong tao dong moi nua, nhung nhung lan da tick van con. */
  enabled: boolean;
}

/** Chu cua mot viec — dai hon thi tran ra khoi dong to o man cua con. */
export const MAX_CHU_VIEC_NHA = 60;

/** Sao toi da cho mot nhiem vu — khop CHECK o migrations/016. */
export const MAX_SAO_NHIEM_VU = 10;
export const SAO_NHIEM_VU_MAC_DINH = 1;

/** Icon mac dinh + goi y cho bo me chon nhanh khi them nhiem vu. */
export const ICON_NHIEM_VU_MAC_DINH = '🧹';
export const ICON_NHIEM_VU_GOI_Y = ['🧹', '🎒', '💡', '📚', '🪥', '🛏️', '🍽️', '🧸', '🌱', '👕', '🐶', '🗑️'];

/** So sao bo me nhap: so nguyen trong [1, MAX_SAO_NHIEM_VU]; hong -> null. */
export function lamSachSao(v: unknown): number | null {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > MAX_SAO_NHIEM_VU) return null;
  return n;
}

/**
 * Bam mot chip con o hang "Giao cho" (man /bome/nhiem-vu-hang-ngay): dang
 * "Cả nhà" (null) -> chi giao cho con do; dang danh sach -> them / bo con do.
 *
 * Bo con CUOI CUNG la KHONG LAM GI — tra ve dung `hienTai` (cung tham chieu, de
 * noi goi biet la khong co gi thay doi). Mang rong thi API chan, ma quy ve null
 * thi thanh "Cả nhà": bo me bam de BO giao mot con lai hoa ra giao cho CA BA
 * con, nguoc han y dinh va khong bao loi gi. Muon ve ca nha thi bam chip
 * "Cả nhà" — day la duong duy nhat, co y.
 */
export function docChildIds(hienTai: string[] | null, childId: string): string[] | null {
  if (hienTai === null) return [childId];
  if (!hienTai.includes(childId)) return [...hienTai, childId];
  const moi = hienTai.filter((x) => x !== childId);
  return moi.length === 0 ? hienTai : moi;
}

/* ---------------- Diem thuong & doi thuong ----------------
 *
 * Luat cong diem nam o lib/diem.ts; luoc do o migrations/015_tinh_diem_doi_thuong.sql.
 * Phan thuong la MOT danh sach chung ca nha (nhu viec nha): bo me dat ten, icon
 * va gia diem o man Phan thuong; moi con thay cung danh sach do o cua hang cua
 * minh va xin doi, bo me duyet roi diem moi bi tru.
 */

export interface Reward {
  id: string;
  name: string;
  /** Mot emoji — con chua doc duoc chu nen icon la thu con nhan ra truoc. */
  icon: string;
  /** Gia bang diem, nguyen duong. */
  cost: number;
  /** Tat thi con khong thay o cua hang nua, lich su doi van con. */
  enabled: boolean;
}

export type RedemptionStatus = 'pending' | 'approved' | 'rejected';

/**
 * Mot lan con xin doi thuong. Ten/icon/gia CHEP tu phan thuong luc xin, nen bo
 * me sua hay xoa phan thuong sau do khong doi yeu cau dang cho va lich su.
 */
export interface Redemption {
  id: string;
  childId: string;
  rewardId: string | null;
  rewardName: string;
  rewardIcon: string;
  cost: number;
  status: RedemptionStatus;
  requestedAt: string;
  decidedAt: string | null;
}

/**
 * Diem vua cong trong MOT lan tick (tra ve tu PATCH /api/assignments/:id) — de
 * man cua con bao ngay "+1", "+10". Xem ghiDiemSauKhiXong trong lib/store.ts.
 */
export interface DiemVuaCong {
  /** DIEM_XONG_SOM neu bai nay vua duoc cong "xong som" o lan tick nay, 0 neu khong. */
  xongSom: number;
  /** DIEM_NGAY_XONG neu ngay cua bai nay VUA duoc cong o lan tick nay, 0 neu khong. */
  ngayXong: number;
  /** So sao cua NHIEM VU nay neu vua duoc cong o lan tick nay (issue #42), 0 neu khong. */
  nhiemVu: number;
  /**
   * So diem con dang co sau lan tick nay — CHI co khi lan tick nay THUC SU cong
   * diem (xongSom, ngayXong hay nhiemVu khac 0). Khong cong gi thi khong tinh: man cua
   * con chi hien so nay kem chip "+1", nen doc no moi luc la mot vong thua Neon
   * khong ai dung.
   */
  tong?: number;
}

/** Ten phan thuong — dai hon thi tran the o cua hang cua con. */
export const MAX_CHU_PHAN_THUONG = 40;
/** Gia toi da — chan go nham (10 diem/ngay thi 9999 diem la ~3 nam). */
export const MAX_GIA_PHAN_THUONG = 9999;

/** Icon mac dinh + goi y cho bo me chon nhanh khi them phan thuong. */
export const ICON_PHAN_THUONG_MAC_DINH = '🎁';
export const ICON_PHAN_THUONG_GOI_Y = ['🎁', '🍦', '🍕', '📺', '🎮', '🧸', '🎡', '📚', '🚲', '🏊', '🎬', '🍫'];

/**
 * Lay dung MOT ky tu hien thi (emoji co the la nhieu code point) tu chu bo me
 * go; trong thi ve icon mac dinh. Dung Intl.Segmenter khi co (Node 16+/Safari
 * 14.1+), khong thi lay tu Array.from (tach theo code point — emoji ghep se
 * mat phan sau, van hien duoc mot hinh).
 */
export function lamSachIcon(v: unknown, macDinh: string = ICON_PHAN_THUONG_MAC_DINH): string {
  const s = String(v ?? '').trim();
  if (!s) return macDinh;
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) {
    for (const g of new Seg('vi', { granularity: 'grapheme' }).segment(s)) return g.segment;
  }
  return Array.from(s)[0] ?? macDinh;
}

/** Gia diem bo me nhap: so nguyen duong, kep tran MAX_GIA_PHAN_THUONG; hong -> null. */
export function lamSachGia(v: unknown): number | null {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, MAX_GIA_PHAN_THUONG);
}

/* ---------------- Tru diem (bo me phat, issue #43) ----------------
 *
 * Luoc do + ly do o migrations/017_tru_diem.sql; SQL o lib/sqlDiem.ts. Captain
 * chot: bo me GO SO ⭐ MUON TRU (moi dong la mot delta duong, khong luu tong sau
 * khi tru), KHONG cho so du am (may chu kep lan tru vao so du con lai, chi tu
 * choi khi con khong con ⭐ nao), ly do KHONG bat buoc, CON NHIN THAY dong tru
 * kem ly do o cua hang, KHONG cong tay.
 */

/** Mot lan bo me tru ⭐ cua con. `points` la so DA TRU lan do (duong). */
export interface Penalty {
  id: string;
  childId: string;
  points: number;
  /** '' = bo me khong ghi ly do — man cua con hien LY_DO_TRU_TRONG thay vao. */
  reason: string;
  createdAt: string;
}

/**
 * Ly do la thu CON DOC (captain, quyet dinh 4), nen cac goi y mot cham viet
 * bang loi NOI DUOC VOI CON — khong phai ghi chu bo me noi voi nhau. Ba cau
 * dau la vi du captain neu. Danh sach co dinh, khong can bang cau hinh.
 */
export const LY_DO_TRU_GOI_Y = [
  'Không nghe lời',
  'Cãi bố mẹ',
  'Không dọn đồ',
  'Chơi quá giờ',
  'Chưa làm bài',
  'Nói dối',
] as const satisfies readonly Key[];

/**
 * Cau hien o man cua con khi bo me de trong ly do — khong de trong hoac, va
 * phai tu te voi con: khong buoc toi, chi moi con hoi lai bo me.
 */
export const LY_DO_TRU_TRONG = 'Con hỏi bố mẹ vì sao nhé' satisfies Key;

/** Ly do dai hon thi tran mot dong lich su (cung tran voi ten viec nha). */
export const MAX_CHU_LY_DO_TRU = MAX_CHU_VIEC_NHA;

/**
 * So ⭐ bo me go de tru: so nguyen duong, kep tran MAX_GIA_PHAN_THUONG (cung tran
 * voi gia phan thuong — chan go nham); hong -> null. Cung khuon lamSachGia.
 */
export function lamSachDiemTru(v: unknown): number | null {
  return lamSachGia(v);
}

/** Ly do bo me go: trim, cat theo MAX_CHU_LY_DO_TRU; trong -> ''. */
export function lamSachLyDoTru(v: unknown): string {
  return String(v ?? '').trim().slice(0, MAX_CHU_LY_DO_TRU);
}

/**
 * MOT cho duy nhat quyet dinh o "tru ⭐" tren man bo me lam gi (issue #43).
 *
 * Hai luat, va chung giai thich het moi nhanh duoi day:
 *
 *   A. NUT LAM DUNG NHUNG GI NHAN CUA NO GHI. `soGui` la con so tren nhan nut, va
 *      la con so gui len may chu — khong bao gio la mot so khac. Nut doc "Trừ hết
 *      5 ⭐" thi gui 5, ke ca khi trong o dang go 8: bo me doc "het 5" roi bam, va
 *      dung 5 ⭐ bi tru, du con vua kiem them thanh 20 o iPad.
 *   B. MAN HINH KHONG TU CHOI, MAY CHU TU CHOI. `dangCo` chi la so man DANG TIN
 *      (props may chu, hoac `conLai` cua lan gui truoc) va co the da cu — ca cu
 *      cao lan cu THAP. Nen o day khong co nhanh nao chan lai vi "con het ⭐":
 *      con so 0 tren man co the la so cua nam phut truoc. Da go so hop le la bam
 *      duoc; may chu moi la cho biet so du that (`SQL_TRU_DIEM` tru
 *      `LEAST(so nhan duoc, so du)`, va tu choi khi so du = 0 — kem `conLai` de
 *      man sua lai vien ⭐ ngay).
 *
 * `nut` la MAT NUT, khong phai giao thuc — ca hai mat gui cung mot dang than:
 *   'tru'    -> "Trừ N ⭐ của …", N = so bo me go (go trong so man dang tin, hoac
 *               man dang tin la 0 — luc do de may chu noi cau cuoi).
 *   'truHet' -> "Trừ hết N ⭐", N = `dangCo`: go qua so man dang tin thi moi bo me
 *               tru het cho con co, mot cham, thay cho nut khoa cut duong bat go
 *               lai cho dung.
 *   null     -> chua go so hop le, chua co gi de gui.
 *
 *   dangCo  so ⭐ man dang tin la con co
 *   soGo    chu trong o nhap
 */
export interface TrangThaiTruDiem {
  nut: 'tru' | 'truHet' | null;
  /** So ghi tren nhan nut = so GUI len may chu; null = chua go so hop le. */
  soGui: number | null;
  /** Dong do duoi o nhap; '' = khong hien gi. */
  canhBao: string;
}

export function trangThaiTruDiem(dangCo: number, soGo: string, T: T = T_VI): TrangThaiTruDiem {
  const soTru = lamSachDiemTru(soGo);
  const truHet = soTru !== null && soTru > dangCo && dangCo > 0;
  return {
    nut: soTru === null ? null : truHet ? 'truHet' : 'tru',
    soGui: soTru === null ? null : truHet ? dangCo : soTru,
    canhBao: truHet ? T('Con chỉ có {n} ⭐', { n: dangCo }) : '',
  };
}
