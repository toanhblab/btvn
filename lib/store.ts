import { query, queryOne } from './db';
import type { Assignment, Child, DraftAssignment, Lang } from './types';

/** Ngay hom nay theo gio dia phuong, YYYY-MM-DD (toISOString la UTC nen lech mui gio). */
export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/* ---------------- Children ---------------- */

interface ChildRow {
  id: string; family_id: string; name: string; avatar_url: string;
  color: string; grade: string | null; sort_order: number;
}

const toChild = (r: ChildRow): Child => ({
  id: r.id,
  familyId: r.family_id,
  name: r.name,
  avatarUrl: r.avatar_url,
  color: r.color as Child['color'],
  grade: r.grade,
  sortOrder: r.sort_order,
});

export async function listChildren(): Promise<Child[]> {
  const rows = await query<ChildRow>(
    `SELECT * FROM children ORDER BY sort_order ASC`
  );
  return rows.map(toChild);
}

export async function getChild(id: string): Promise<Child | null> {
  const r = await queryOne<ChildRow>(`SELECT * FROM children WHERE id = $1`, [id]);
  return r ? toChild(r) : null;
}

/**
 * Bo me sua ho so mot con: ten, anh, lop, mau.
 *
 * Ten va anh la thu tre dung de tu nhan ra minh (PRD muc 3) nen doi duoc tu
 * giao dien, khong phai sua seed roi nap lai — nap lai se xoa sach bai tap cu.
 */
export async function updateChild(
  id: string,
  patch: Partial<Pick<Child, 'name' | 'avatarUrl' | 'color' | 'grade'>>
): Promise<Child | null> {
  const map: Record<string, string> = {
    name: 'name', avatarUrl: 'avatar_url', color: 'color', grade: 'grade',
  };
  const sets: string[] = [];
  const params: unknown[] = [id];

  for (const [k, col] of Object.entries(map)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v !== undefined) { params.push(v); sets.push(`${col} = $${params.length}`); }
  }
  if (sets.length) {
    await query(`UPDATE children SET ${sets.join(', ')} WHERE id = $1`, params);
  }
  return getChild(id);
}

/* ---------------- Assignments ---------------- */

interface AssignmentRow {
  id: string; submission_id: string | null; child_id: string;
  subject: string; icon: string; content: string; note: string | null;
  lang: string; due_date: string | Date; status: string;
  completed_at: string | Date | null; image_url: string | null;
}

/** Neon tra due_date dang string, PGlite tra Date — chuan hoa ve YYYY-MM-DD. */
function dateStr(v: string | Date): string {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v).slice(0, 10);
}

const toAssignment = (r: AssignmentRow): Assignment => ({
  id: r.id,
  submissionId: r.submission_id,
  childId: r.child_id,
  subject: r.subject,
  icon: r.icon,
  content: r.content,
  note: r.note,
  lang: r.lang as Lang,
  dueDate: dateStr(r.due_date),
  status: r.status as Assignment['status'],
  completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
  imageUrl: r.image_url,
});

export async function listAssignments(opts: {
  childId?: string;
  date?: string;
  from?: string;
  to?: string;
}): Promise<Assignment[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.childId) { params.push(opts.childId); where.push(`child_id = $${params.length}`); }
  if (opts.date)    { params.push(opts.date);    where.push(`due_date = $${params.length}`); }
  if (opts.from)    { params.push(opts.from);    where.push(`due_date >= $${params.length}`); }
  if (opts.to)      { params.push(opts.to);      where.push(`due_date <= $${params.length}`); }

  const rows = await query<AssignmentRow>(
    `SELECT * FROM assignments
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY due_date ASC, subject ASC, id ASC`,
    params
  );
  return rows.map(toAssignment);
}

export async function getAssignment(id: string): Promise<Assignment | null> {
  const r = await queryOne<AssignmentRow>(`SELECT * FROM assignments WHERE id = $1`, [id]);
  return r ? toAssignment(r) : null;
}

/**
 * Luu mot dot nhap cua bo me: 1 submission -> N bai x M con.
 * Moi con nhan MOT BAN RIENG du de bai giong het nhau, de tick doc lap (PRD 4.2).
 */
export async function saveSubmission(input: {
  familyId: string;
  rawText: string | null;
  imageUrls: string[];
  childIds: string[];
  dueDate: string;
  drafts: DraftAssignment[];
}): Promise<Assignment[]> {
  const subId = newId('sub');
  await query(
    `INSERT INTO submissions (id, family_id, raw_text) VALUES ($1, $2, $3)`,
    [subId, input.familyId, input.rawText]
  );

  for (const url of input.imageUrls) {
    await query(
      `INSERT INTO submission_images (id, submission_id, blob_url) VALUES ($1, $2, $3)`,
      [newId('img'), subId, url]
    );
  }

  const created: Assignment[] = [];
  const coverImage = input.imageUrls[0] ?? null;

  for (const childId of input.childIds) {
    for (const d of input.drafts) {
      const id = newId('asg');
      await query(
        `INSERT INTO assignments
           (id, submission_id, child_id, subject, icon, content, note, lang, due_date, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, subId, childId, d.subject, d.icon, d.content, d.note, d.lang, input.dueDate, coverImage]
      );
      const a = await getAssignment(id);
      if (a) created.push(a);
    }
  }
  return created;
}

/** Tick xong / bo tick. PRD 4.3: tre tick nham phai bo duoc. */
export async function setStatus(id: string, done: boolean): Promise<Assignment | null> {
  await query(
    `UPDATE assignments SET status = $2, completed_at = $3 WHERE id = $1`,
    [id, done ? 'done' : 'todo', done ? new Date().toISOString() : null]
  );
  return getAssignment(id);
}

export async function updateAssignment(
  id: string,
  patch: Partial<Pick<Assignment, 'subject' | 'icon' | 'content' | 'note' | 'lang' | 'dueDate'>>
): Promise<Assignment | null> {
  const map: Record<string, string> = {
    subject: 'subject', icon: 'icon', content: 'content',
    note: 'note', lang: 'lang', dueDate: 'due_date',
  };
  const sets: string[] = [];
  const params: unknown[] = [id];

  for (const [k, col] of Object.entries(map)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v !== undefined) { params.push(v); sets.push(`${col} = $${params.length}`); }
  }
  if (sets.length) {
    await query(`UPDATE assignments SET ${sets.join(', ')} WHERE id = $1`, params);
  }
  return getAssignment(id);
}

export async function deleteAssignment(id: string): Promise<void> {
  await query(`DELETE FROM assignments WHERE id = $1`, [id]);
}

export async function countAssignments(): Promise<number> {
  const r = await queryOne<{ n: number | string }>(`SELECT COUNT(*) AS n FROM assignments`);
  return Number(r?.n ?? 0);
}

/**
 * Xoa sach bai tap cua ca nha. Dung khi bo me muon lam lai tu dau — vi du sau
 * mot dot nhap thu, hoac dau nam hoc moi.
 *
 * Xoa luon bang submissions (cac dot nhap tho: text goc + anh). Bang do khong
 * hien o man nao ca, chi ghi vao roi thoi; de lai thi thanh rac, ma khi chua bat
 * Vercel Blob thi anh nam duoi dang base64 ngay trong DB nen rat nang.
 * submission_images tu di theo nho ON DELETE CASCADE.
 *
 * @returns so bai da xoa
 */
export async function deleteAllAssignments(): Promise<number> {
  const n = await countAssignments();
  await query(`DELETE FROM assignments`);
  await query(`DELETE FROM submissions`);
  return n;
}

/* ---------------- Tong hop cho bang dieu khien cua bo me ---------------- */

export interface ChildProgress {
  child: Child;
  total: number;
  done: number;
  overdue: number;
}

/**
 * Bai TU HOM NAY TRO DI, khong phai rieng hom nay: bo me hay nhap bai vao toi
 * hom truoc cho ngay hom sau, dem moi hom nay thi bang dieu khien bao 0 trong
 * khi bai da nam san trong may. Man cua con cung liet ke tu hom nay tro di nen
 * hai ben phai dem giong nhau, khong thi badge "Chua co bai" ma mo ra van co bai.
 */
export async function progressUpcoming(): Promise<ChildProgress[]> {
  const today = todayISO();
  const children = await listChildren();
  // Bai da xong cua nhung ngay truoc khong con y nghia -> chi lay bai sap toi va bai con no
  const rows = await query<{ child_id: string; status: string; due_date: string | Date }>(
    `SELECT child_id, status, due_date FROM assignments WHERE due_date >= $1 OR status = 'todo'`,
    [today]
  );

  return children.map((child) => {
    const mine = rows.filter((r) => r.child_id === child.id);
    const upcoming = mine.filter((r) => dateStr(r.due_date) >= today);
    return {
      child,
      total: upcoming.length,
      done: upcoming.filter((r) => r.status === 'done').length,
      // Qua han = han truoc hom nay ma van chua xong
      overdue: mine.filter((r) => dateStr(r.due_date) < today && r.status === 'todo').length,
    };
  });
}

export async function getFamily(): Promise<{ id: string; name: string; slug: string } | null> {
  return queryOne(`SELECT id, name, slug FROM families ORDER BY created_at ASC LIMIT 1`);
}
