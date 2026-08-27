import { query, queryOne } from './db';
import type {
  Assignment, AttachedMedia, Child, ChildColor, DraftAssignment, HwSource, Lang, MediaKind,
} from './types';

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

/* ---------------- Gia dinh ----------------
 *
 * Nhieu gia dinh dung chung mot app. MOI truy van duoi day nhan familyId va tu
 * loc theo no — khong ham nao duoc phep tra ve du lieu "cua ca DB" nua, vi lam
 * vay la cho nha nay xem bai tap va anh chup cua con nha khac.
 */

export interface Family {
  id: string;
  name: string;
  slug: string;
}

const FAMILY_COLS = 'id, name, slug';

export async function getFamilyById(id: string): Promise<Family | null> {
  return queryOne<Family>(`SELECT ${FAMILY_COLS} FROM families WHERE id = $1`, [id]);
}

/** Tra nha tu duong dan chia se cho iPad (/nha/<slug>). */
export async function getFamilyBySlug(slug: string): Promise<Family | null> {
  return queryOne<Family>(`SELECT ${FAMILY_COLS} FROM families WHERE slug = $1`, [slug]);
}

/** Tra nha tu ma PIN da hash — day la cach "dang nhap" duy nhat cua app. */
export async function findFamilyByPinHash(pinHash: string): Promise<Family | null> {
  return queryOne<Family>(
    `SELECT ${FAMILY_COLS} FROM families WHERE parent_pin_hash = $1`,
    [pinHash]
  );
}

export async function pinHashTaken(pinHash: string, exceptFamilyId?: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM families WHERE parent_pin_hash = $1 AND ($2::text IS NULL OR id <> $2)`,
    [pinHash, exceptFamilyId ?? null]
  );
  return row !== null;
}

/**
 * Tao nha moi.
 *
 * slug ngau nhien (khong doan duoc tu ben ngoai) vi day la duong dan mo man cua
 * con ma khong can dang nhap (PRD muc 10).
 *
 * Nem loi neu PIN da co nha khac dung — unique index families_pin_idx. Nguoi goi
 * phai kiem pinHashTaken truoc de bao loi tu te, day chi la chot cuoi.
 */
export async function insertFamily(name: string, pinHash: string): Promise<Family> {
  const family: Family = {
    id: newId('fam'),
    name,
    slug: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
  };
  await query(
    `INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ($1,$2,$3,$4)`,
    [family.id, family.name, family.slug, pinHash]
  );
  return family;
}

export async function updateFamilyPinHash(id: string, pinHash: string): Promise<void> {
  await query(`UPDATE families SET parent_pin_hash = $2 WHERE id = $1`, [id, pinHash]);
}

export async function updateFamilyName(id: string, name: string): Promise<void> {
  await query(`UPDATE families SET name = $2 WHERE id = $1`, [id, name]);
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

export async function listChildren(familyId: string): Promise<Child[]> {
  const rows = await query<ChildRow>(
    `SELECT * FROM children WHERE family_id = $1 ORDER BY sort_order ASC`,
    [familyId]
  );
  return rows.map(toChild);
}

/** Tra null neu con nay thuoc nha khac — dung lam luon lop kiem tra so huu. */
export async function getChild(familyId: string, id: string): Promise<Child | null> {
  const r = await queryOne<ChildRow>(
    `SELECT * FROM children WHERE id = $1 AND family_id = $2`,
    [id, familyId]
  );
  return r ? toChild(r) : null;
}

/**
 * Them mot con. Nha moi tao chua co con nao nen day la buoc bat buoc truoc khi
 * nhap bai — truoc day chi seed script tao duoc con, bo me khong tu them duoc.
 */
export async function createChild(
  familyId: string,
  input: { name: string; avatarUrl: string; color: ChildColor; grade: string | null }
): Promise<Child> {
  const row = await queryOne<{ n: number | string | null }>(
    `SELECT MAX(sort_order) AS n FROM children WHERE family_id = $1`,
    [familyId]
  );
  const id = newId('chd');
  await query(
    `INSERT INTO children (id, family_id, name, avatar_url, color, grade, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, familyId, input.name, input.avatarUrl, input.color, input.grade, Number(row?.n ?? 0) + 1]
  );
  return (await getChild(familyId, id))!;
}

/**
 * Bo me sua ho so mot con: ten, anh, lop, mau.
 *
 * Ten va anh la thu tre dung de tu nhan ra minh (PRD muc 3) nen doi duoc tu
 * giao dien, khong phai sua seed roi nap lai — nap lai se xoa sach bai tap cu.
 */
export async function updateChild(
  familyId: string,
  id: string,
  patch: Partial<Pick<Child, 'name' | 'avatarUrl' | 'color' | 'grade'>>
): Promise<Child | null> {
  const map: Record<string, string> = {
    name: 'name', avatarUrl: 'avatar_url', color: 'color', grade: 'grade',
  };
  const sets: string[] = [];
  const params: unknown[] = [id, familyId];

  for (const [k, col] of Object.entries(map)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v !== undefined) { params.push(v); sets.push(`${col} = $${params.length}`); }
  }
  if (sets.length) {
    await query(
      `UPDATE children SET ${sets.join(', ')} WHERE id = $1 AND family_id = $2`,
      params
    );
  }
  return getChild(familyId, id);
}

/** Xoa mot con. Bai tap cua con do di theo nho ON DELETE CASCADE. */
export async function deleteChild(familyId: string, id: string): Promise<void> {
  await query(`DELETE FROM children WHERE id = $1 AND family_id = $2`, [id, familyId]);
}

/* ---------------- Assignments ----------------
 *
 * Bang assignments khong co cot family_id — no thuoc nha nao la qua con
 * (child_id -> children.family_id). Nen moi cau o day deu join hoac loc bang
 * subquery theo children. Khong nhan doi cot family_id vao assignments de khong
 * bao gio co chuyen hai cho ghi lech nhau.
 */

interface AssignmentRow {
  id: string; submission_id: string | null; child_id: string;
  subject: string; icon: string; content: string; note: string | null;
  lang: string; due_date: string | Date; source: string; status: string;
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

const toAssignment = (r: AssignmentRow, media: AttachedMedia[]): Assignment => ({
  id: r.id,
  submissionId: r.submission_id,
  childId: r.child_id,
  subject: r.subject,
  icon: r.icon,
  content: r.content,
  note: r.note,
  lang: r.lang as Lang,
  dueDate: dateStr(r.due_date),
  source: r.source as HwSource,
  status: r.status as Assignment['status'],
  completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
  imageUrl: r.image_url,
  media,
});

/**
 * Tep dinh kem (video, ghi am, anh) cua mot loat bai, tra ve map
 * assignment_id -> danh sach tep. Goi MOT lan cho ca danh sach thay vi tung bai
 * mot, khong thi man nhiem vu (vai chuc bai) thanh vai chuc cau SQL.
 */
async function mediaByAssignment(ids: string[]): Promise<Map<string, AttachedMedia[]>> {
  const map = new Map<string, AttachedMedia[]>();
  if (ids.length === 0) return map;
  const rows = await query<{ assignment_id: string; url: string; name: string; kind: string }>(
    `SELECT assignment_id, url, name, kind FROM assignment_media
     WHERE assignment_id = ANY($1) ORDER BY sort_order ASC, id ASC`,
    [ids]
  );
  for (const r of rows) {
    const list = map.get(r.assignment_id) ?? [];
    list.push({ url: r.url, name: r.name, kind: r.kind as MediaKind });
    map.set(r.assignment_id, list);
  }
  return map;
}

/** Loc "bai nay thuoc nha do" dung trong UPDATE/DELETE, noi khong join duoc. */
const OF_FAMILY = `child_id IN (SELECT id FROM children WHERE family_id = $2)`;

export async function listAssignments(
  familyId: string,
  opts: { childId?: string; date?: string; from?: string; to?: string }
): Promise<Assignment[]> {
  const where: string[] = ['c.family_id = $1'];
  const params: unknown[] = [familyId];

  if (opts.childId) { params.push(opts.childId); where.push(`a.child_id = $${params.length}`); }
  if (opts.date)    { params.push(opts.date);    where.push(`a.due_date = $${params.length}`); }
  if (opts.from)    { params.push(opts.from);    where.push(`a.due_date >= $${params.length}`); }
  if (opts.to)      { params.push(opts.to);      where.push(`a.due_date <= $${params.length}`); }

  const rows = await query<AssignmentRow>(
    `SELECT a.* FROM assignments a
     JOIN children c ON c.id = a.child_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.due_date ASC, a.subject ASC, a.id ASC`,
    params
  );
  const media = await mediaByAssignment(rows.map((r) => r.id));
  return rows.map((r) => toAssignment(r, media.get(r.id) ?? []));
}

export async function getAssignment(familyId: string, id: string): Promise<Assignment | null> {
  const r = await queryOne<AssignmentRow>(
    `SELECT a.* FROM assignments a
     JOIN children c ON c.id = a.child_id
     WHERE a.id = $1 AND c.family_id = $2`,
    [id, familyId]
  );
  if (!r) return null;
  const media = await mediaByAssignment([r.id]);
  return toAssignment(r, media.get(r.id) ?? []);
}

/**
 * Luu mot dot nhap cua bo me: 1 submission -> N bai x M con.
 * Moi con nhan MOT BAN RIENG du de bai giong het nhau, de tick doc lap (PRD 4.2).
 *
 * childIds duoc loc lai theo nha truoc khi ghi: neu goi API voi id con nha khac
 * thi bai do khong duoc tao ra.
 */
export async function saveSubmission(input: {
  familyId: string;
  rawText: string | null;
  imageUrls: string[];
  childIds: string[];
  dueDate: string;
  /** Noi giao ca dot bai nay — moi bai sinh ra deu mang nguon nay. */
  source: HwSource;
  drafts: DraftAssignment[];
}): Promise<Assignment[]> {
  const mine = new Set((await listChildren(input.familyId)).map((c) => c.id));
  const childIds = input.childIds.filter((id) => mine.has(id));
  if (childIds.length === 0) return [];

  const subId = newId('sub');
  await query(
    `INSERT INTO submissions (id, family_id, raw_text, source) VALUES ($1, $2, $3, $4)`,
    [subId, input.familyId, input.rawText, input.source]
  );

  for (const url of input.imageUrls) {
    await query(
      `INSERT INTO submission_images (id, submission_id, blob_url) VALUES ($1, $2, $3)`,
      [newId('img'), subId, url]
    );
  }

  const created: Assignment[] = [];
  const coverImage = input.imageUrls[0] ?? null;

  for (const childId of childIds) {
    for (const d of input.drafts) {
      const id = newId('asg');
      await query(
        `INSERT INTO assignments
           (id, submission_id, child_id, subject, icon, content, note, lang, due_date, source, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, subId, childId, d.subject, d.icon, d.content, d.note, d.lang, input.dueDate, input.source, coverImage]
      );
      // Moi con mot ban bai rieng nen tep dinh kem cung ghi rieng cho tung ban —
      // xoa bai cua con nay khong duoc lam mat tep o bai cua con kia.
      for (const [mi, m] of (d.media ?? []).entries()) {
        await query(
          `INSERT INTO assignment_media (id, assignment_id, url, name, kind, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [newId('med'), id, m.url, m.name, m.kind, mi]
        );
      }
      const a = await getAssignment(input.familyId, id);
      if (a) created.push(a);
    }
  }
  return created;
}

/** Tick xong / bo tick. PRD 4.3: tre tick nham phai bo duoc. */
export async function setStatus(
  familyId: string,
  id: string,
  done: boolean
): Promise<Assignment | null> {
  await query(
    `UPDATE assignments SET status = $3, completed_at = $4 WHERE id = $1 AND ${OF_FAMILY}`,
    [id, familyId, done ? 'done' : 'todo', done ? new Date().toISOString() : null]
  );
  return getAssignment(familyId, id);
}

export async function updateAssignment(
  familyId: string,
  id: string,
  patch: Partial<Pick<Assignment, 'subject' | 'icon' | 'content' | 'note' | 'lang' | 'dueDate' | 'source'>> & {
    /** Co mat = THAY CA DANH SACH tep dinh kem cua bai bang danh sach nay. */
    media?: AttachedMedia[];
  }
): Promise<Assignment | null> {
  const map: Record<string, string> = {
    subject: 'subject', icon: 'icon', content: 'content',
    note: 'note', lang: 'lang', dueDate: 'due_date', source: 'source',
  };
  const sets: string[] = [];
  const params: unknown[] = [id, familyId];

  for (const [k, col] of Object.entries(map)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v !== undefined) { params.push(v); sets.push(`${col} = $${params.length}`); }
  }
  if (sets.length) {
    await query(
      `UPDATE assignments SET ${sets.join(', ')} WHERE id = $1 AND ${OF_FAMILY}`,
      params
    );
  }

  if (patch.media !== undefined) {
    // Xoa het roi ghi lai cho don gian — danh sach tep mot bai chi vai phan
    // tu. Kiem so huu truoc: khong duoc dong den tep cua bai nha khac.
    const own = await queryOne<{ id: string }>(
      `SELECT id FROM assignments WHERE id = $1 AND ${OF_FAMILY}`,
      [id, familyId]
    );
    if (own) {
      await query(`DELETE FROM assignment_media WHERE assignment_id = $1`, [id]);
      for (const [mi, m] of patch.media.entries()) {
        await query(
          `INSERT INTO assignment_media (id, assignment_id, url, name, kind, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [newId('med'), id, m.url, m.name, m.kind, mi]
        );
      }
    }
  }

  return getAssignment(familyId, id);
}

export async function deleteAssignment(familyId: string, id: string): Promise<void> {
  await query(`DELETE FROM assignments WHERE id = $1 AND ${OF_FAMILY}`, [id, familyId]);
}

export async function countAssignments(familyId: string): Promise<number> {
  const r = await queryOne<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM assignments a
     JOIN children c ON c.id = a.child_id
     WHERE c.family_id = $1`,
    [familyId]
  );
  return Number(r?.n ?? 0);
}

/**
 * Xoa sach bai tap CUA MOT NHA. Dung khi bo me muon lam lai tu dau — vi du sau
 * mot dot nhap thu, hoac dau nam hoc moi.
 *
 * Xoa luon bang submissions cua nha do (cac dot nhap tho: text goc + anh). Bang
 * do khong hien o man nao ca, chi ghi vao roi thoi; de lai thi thanh rac, ma khi
 * chua bat Vercel Blob thi anh nam duoi dang base64 ngay trong DB nen rat nang.
 * submission_images tu di theo nho ON DELETE CASCADE.
 *
 * @returns so bai da xoa
 */
export async function deleteAllAssignments(familyId: string): Promise<number> {
  const n = await countAssignments(familyId);
  await query(
    `DELETE FROM assignments WHERE child_id IN (SELECT id FROM children WHERE family_id = $1)`,
    [familyId]
  );
  await query(`DELETE FROM submissions WHERE family_id = $1`, [familyId]);
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
export async function progressUpcoming(familyId: string): Promise<ChildProgress[]> {
  const today = todayISO();
  const children = await listChildren(familyId);
  // Bai da xong cua nhung ngay truoc khong con y nghia -> chi lay bai sap toi va bai con no
  const rows = await query<{ child_id: string; status: string; due_date: string | Date }>(
    `SELECT a.child_id, a.status, a.due_date FROM assignments a
     JOIN children c ON c.id = a.child_id
     WHERE c.family_id = $1 AND (a.due_date >= $2 OR a.status = 'todo')`,
    [familyId, today]
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
