/** Kieu du lieu dung chung — bam theo PRD muc 7. */

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
export const HW_SOURCES: Record<HwSource, { label: string; icon: string }> = {
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

/** Danh sach mon co dinh + icon. PRD muc 12 con de mo, tam chot ngan gon. */
export const SUBJECTS: Record<string, string> = {
  'Toán': '🔢',
  'Tiếng Việt': '📖',
  'Tiếng Anh': '🔤',
  'Vẽ': '🎨',
  'Tự nhiên': '🐝',
  'Khác': '📝',
};

export function iconFor(subject: string): string {
  return SUBJECTS[subject] ?? SUBJECTS['Khác'];
}

/* ---------------- Nhiem vu moi ngay ("viec nha") ----------------
 *
 * MOT danh sach chung ca nha, khong phai moi con mot danh sach (issue #25): bo me
 * sua o man Cai dat, moi con deu thay danh sach do o man khen sau khi lam xong
 * bai cuoi cung cua hom nay.
 */

export interface DailyChore {
  id: string;
  content: string;
  sortOrder: number;
  /** Tat thi con khong thay nua, nhung nhung lan da tick van con. */
  enabled: boolean;
}

/** Chu cua mot viec — dai hon thi tran ra khoi dong to o man cua con. */
export const MAX_CHU_VIEC_NHA = 60;

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
  /**
   * So diem con dang co sau lan tick nay — CHI co khi lan tick nay THUC SU cong
   * diem (xongSom hay ngayXong khac 0). Khong cong gi thi khong tinh: man cua
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
export function lamSachIcon(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return ICON_PHAN_THUONG_MAC_DINH;
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) {
    for (const g of new Seg('vi', { granularity: 'grapheme' }).segment(s)) return g.segment;
  }
  return Array.from(s)[0] ?? ICON_PHAN_THUONG_MAC_DINH;
}

/** Gia diem bo me nhap: so nguyen duong, kep tran MAX_GIA_PHAN_THUONG; hong -> null. */
export function lamSachGia(v: unknown): number | null {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, MAX_GIA_PHAN_THUONG);
}
