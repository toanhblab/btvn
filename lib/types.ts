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
 * MA DINH DANH trong DB la co dinh ('primary_school', 'english_class') — doi nhan
 * hien thi thi chi sua HW_SOURCES, dung sua ma, khong thi du lieu cu mat nguon.
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

/** Nguon mac dinh khi gia tri khong doc duoc: khoa dau bang. */
const HW_SOURCE_DEFAULT = Object.keys(HW_SOURCES)[0] as HwSource;

/**
 * Loc gia tri la tu ngoai vao (API body, sessionStorage cu) ve mot nguon hop le.
 *
 * Doi chieu voi TAP KHOA cua HW_SOURCES chu khong viet cung tung ten — truoc day
 * ham nay nhi phan ("khong phai english_class thi la primary_school") nen nguon
 * moi bi nuot am tham luc doc lai tu DB.
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
