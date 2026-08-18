/** Kieu du lieu dung chung — bam theo PRD muc 7. */

export type Lang = 'vi' | 'en';
export type Status = 'todo' | 'done';

/** Mau rieng cua tung con. Hai be sinh doi phai khac mau vi chua doc thao ten. */
export type ChildColor = 'primary' | 'secondary' | 'tertiary';

export interface Child {
  id: string;
  familyId: string;
  name: string;
  color: ChildColor;
  avatarUrl: string;
  grade: string | null;
  sortOrder: number;
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
  status: Status;
  completedAt: string | null;
  imageUrl: string | null;
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
