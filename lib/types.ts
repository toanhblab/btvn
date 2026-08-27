/** Kieu du lieu dung chung — bam theo PRD muc 7. */

export type Lang = 'vi' | 'en';
export type Status = 'todo' | 'done';

/** Mau rieng cua tung con. Hai be sinh doi phai khac mau vi chua doc thao ten. */
export type ChildColor = 'primary' | 'secondary' | 'tertiary';

/**
 * Noi giao bai: lop hoc them tieng Anh hay truong tieu hoc. Con can hai nhom
 * rieng de lam xong het mot loai roi moi sang loai kia. Them nguon moi (lop ve,
 * lop nhac...) thi noi vao day + HW_SOURCES, DB khong co CHECK nen khong can
 * migration.
 */
export type HwSource = 'primary_school' | 'english_class';

/** Nhan + icon tung nguon. Thu tu khoa = thu tu hien o man cua con. */
export const HW_SOURCES: Record<HwSource, { label: string; icon: string }> = {
  primary_school: { label: 'Trường tiểu học', icon: '🏫' },
  english_class: { label: 'Lớp tiếng Anh', icon: '🇬🇧' },
};

/** Loc gia tri la tu ngoai vao (API body, sessionStorage cu) ve mot nguon hop le. */
export function hwSourceOf(v: unknown): HwSource {
  return v === 'english_class' ? 'english_class' : 'primary_school';
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
