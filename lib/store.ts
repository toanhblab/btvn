import { query, queryOne } from './db';
import {
  DIEM_NGAY_XONG, DIEM_XONG_SOM, ngayDuocTinhDiem, ngayHoanThanh, xongSom,
} from './diem';
import type {
  Assignment, AttachedMedia, Child, ChildColor, DailyChore, DiemVuaCong, DraftAssignment, HwSource,
  Lang, MediaKind, NhomNhiemVu, Redemption, RedemptionStatus, Reward,
} from './types';
import { DURATION_DEFAULT, HW_SOURCE_DEFAULT, hwSourceOf, nhomNhiemVuOf } from './types';

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
  /**
   * Ngay bat dau tinh diem (YYYY-MM-DD) — bai co due_date truoc ngay nay khong
   * duoc cong 10 diem "ngay xong" (khong hoi to). Migration 015 dat = ngay
   * migration chay cho nha dang co, nha moi = ngay tao.
   */
  scoreSince: string;
}

interface FamilyRow { id: string; name: string; slug: string; score_since: string | Date }

const FAMILY_COLS = 'id, name, slug, score_since';

const toFamily = (r: FamilyRow): Family => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  scoreSince: dateStr(r.score_since),
});

export async function getFamilyById(id: string): Promise<Family | null> {
  const r = await queryOne<FamilyRow>(`SELECT ${FAMILY_COLS} FROM families WHERE id = $1`, [id]);
  return r ? toFamily(r) : null;
}

/** Tra nha tu duong dan chia se cho iPad (/nha/<slug>). */
export async function getFamilyBySlug(slug: string): Promise<Family | null> {
  const r = await queryOne<FamilyRow>(`SELECT ${FAMILY_COLS} FROM families WHERE slug = $1`, [slug]);
  return r ? toFamily(r) : null;
}

/** Tra nha tu ma PIN da hash — day la cach "dang nhap" duy nhat cua app. */
export async function findFamilyByPinHash(pinHash: string): Promise<Family | null> {
  const r = await queryOne<FamilyRow>(
    `SELECT ${FAMILY_COLS} FROM families WHERE parent_pin_hash = $1`,
    [pinHash]
  );
  return r ? toFamily(r) : null;
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
  const id = newId('fam');
  const slug = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  // score_since lay DEFAULT CURRENT_DATE cua DB (migrations/015) roi doc lai,
  // khong tu tinh o day de hai ben khong lech mui gio.
  const rows = await query<FamilyRow>(
    `INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ($1,$2,$3,$4)
     RETURNING ${FAMILY_COLS}`,
    [id, name, slug, pinHash]
  );
  const family = toFamily(rows[0]);
  // Nha moi co san ba viec nha mac dinh, giong nhung nha da co tu truoc (migration
  // 012 nap cho ho). Bo me sua/tat/xoa duoc ngay o man Cai dat.
  //
  // Nap that bai thi bo qua: dong families o tren da commit roi (khong chung mot
  // transaction), nen nem loi len se tra 500 trong khi nha VAN da duoc tao — bo me
  // thu lai dung ma PIN do se bi bao "ma PIN nay co nha khac dung roi", ket han.
  // Vi du that bai: bang daily_chores chua co vi moi truong dat SKIP_MIGRATIONS=1.
  // Viec nha mac dinh chi la "co thi tot", con tao duoc nha moi la bat buoc.
  try {
    await seedDefaultChores(family.id);
  } catch (e) {
    console.error('Khong nap duoc viec nha mac dinh cho nha moi', family.id, e);
  }
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
  duration_minutes: number;
  requires_video: boolean; submitted_video_url: string | null;
  submitted_video_at: string | Date | null;
  chore_id: string | null;
  started_at: string | Date | null;
  stars: number | string | null;
  /** Tu LEFT JOIN daily_chores (xem ASSIGNMENT_SELECT) — null neu khong phai viec nha. */
  chore_category: string | null;
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
  source: hwSourceOf(r.source),
  status: r.status as Assignment['status'],
  completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
  imageUrl: r.image_url,
  media,
  durationMinutes: Number(r.duration_minutes ?? 10),
  requiresVideo: Boolean(r.requires_video),
  submittedVideoUrl: r.submitted_video_url,
  submittedVideoAt: r.submitted_video_at ? new Date(r.submitted_video_at).toISOString() : null,
  choreId: r.chore_id,
  startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
  stars: r.stars === null || r.stars === undefined ? null : Number(r.stars),
  choreNhom: r.chore_id === null || r.chore_category === null ? null : nhomNhiemVuOf(r.chore_category),
});

/**
 * Cot doc cho moi cau tra ve Assignment: a.* + NHOM cua viec nha, doc LIVE tu
 * daily_chores (issue #42) nhu sort_order o ORDER BY ben duoi — nhom la chuyen
 * "hien o dau", giong thu tu, khong phai "duoc gi" nhu stars (stars thi CHEP vao
 * dong luc tao, xem taoNhiemVuNgay). Bo me doi nhom cua mot nhiem vu thi dong
 * hom nay doi cho theo ngay; doi sao thi dong hom nay giu sao cu.
 */
const ASSIGNMENT_SELECT = `a.*, dc.category AS chore_category`;
const ASSIGNMENT_FROM = `assignments a
     JOIN children c ON c.id = a.child_id
     LEFT JOIN daily_chores dc ON dc.id = a.chore_id`;

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
  opts: {
    childId?: string; date?: string; from?: string; to?: string; source?: HwSource;
    /**
     * Viec nha (chore_id khong null, issue #36) chi tra ve khi noi goi xin ro.
     * Mac dinh false/vang mat -> loai het viec nha, dung y HANH VI CU truoc khi
     * co cot chore_id, nen MOI noi goi hien co (man bo me, progressUpcoming...)
     * khong can sua gi ma van dung nguyen — kho la bao ve mot quyet dinh cu da
     * co san: viec nha khong duoc cong vao tien do bai tap cua man bo me (xem
     * chu thich o app/bome/(khung)/con/[childId]/page.tsx). Chi man cua con
     * (app/con/[childId]/page.tsx, va tinh celebrate o bai/[id]/page.tsx) xin
     * includeChores: true.
     */
    includeChores?: boolean;
  }
): Promise<Assignment[]> {
  const where: string[] = ['c.family_id = $1'];
  const params: unknown[] = [familyId];

  if (opts.childId) { params.push(opts.childId); where.push(`a.child_id = $${params.length}`); }
  if (opts.date)    { params.push(opts.date);    where.push(`a.due_date = $${params.length}`); }
  if (opts.from)    { params.push(opts.from);    where.push(`a.due_date >= $${params.length}`); }
  if (opts.to)      { params.push(opts.to);      where.push(`a.due_date <= $${params.length}`); }
  // Loc theo MA nguon ('english_class'...), khong theo ten mon: ten mon la chu
  // bo me go tay nen "Tiếng Anh" o nha nay co the la "English" o nha khac.
  if (opts.source)  { params.push(opts.source);  where.push(`a.source = $${params.length}`); }
  if (!opts.includeChores) where.push(`a.chore_id IS NULL`);

  // dc.sort_order trong ORDER BY: moi dong viec nha deu mang cung subject
  // (VIEC_NHA_SUBJECT) nen neu khong co no, khoa phan dinh cuoi cung la a.id —
  // ma id sinh ngau nhien (newId), tuc thu tu bo me xep bang hai nut mui ten o
  // man Cai dat (moveChore danh lai sort_order 1..n) khong toi duoc man nao.
  // Sap o ngay ranh gioi nay de moi noi doc deu duoc dung thu tu, khong phai
  // sap lai o tung man. Bai tap that co sort_order NULL nen NULLS FIRST giu
  // chung dung truoc neu bo me tinh co go ten mon trung voi "Việc nhà".
  const rows = await query<AssignmentRow>(
    `SELECT ${ASSIGNMENT_SELECT} FROM ${ASSIGNMENT_FROM}
     WHERE ${where.join(' AND ')}
     ORDER BY a.due_date ASC, a.subject ASC, dc.sort_order ASC NULLS FIRST, a.id ASC`,
    params
  );
  const media = await mediaByAssignment(rows.map((r) => r.id));
  return rows.map((r) => toAssignment(r, media.get(r.id) ?? []));
}

export async function getAssignment(familyId: string, id: string): Promise<Assignment | null> {
  const r = await queryOne<AssignmentRow>(
    `SELECT ${ASSIGNMENT_SELECT} FROM ${ASSIGNMENT_FROM}
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
           (id, submission_id, child_id, subject, icon, content, note, lang, due_date, source, image_url,
            duration_minutes, requires_video)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [id, subId, childId, d.subject, d.icon, d.content, d.note, d.lang, input.dueDate, input.source, coverImage,
         d.durationMinutes ?? 10, d.requiresVideo ?? false]
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

  // Nhiem vu hang ngay (issue #36, #42): dot bai nay cho (con, ngay) thi cac
  // dong nhiem vu cua (con, ngay) do cung duoc tao ngay — ke ca ngay mai — de
  // con thay chung duoi nhom "Ngay mai" cung luc voi bai. Tu #42 day KHONG con
  // la noi duy nhat tao dong: ngay khong co bai thi taoNhiemVuNgay chay luc mo
  // man cua con / man chon-con (progressUpcoming). Idempotent nen goi thua
  // khong sao.
  //
  // Nuot loi, y het seedDefaultChores o insertFamily: cac dong bai tap that o
  // tren da ghi xong va khong chung transaction voi khoi nay, nen nem loi len se
  // tra 500 cho mot dot nhap DA THANH CONG — bo me nhap lai la sinh ban sao ca
  // dot bai. Bai tap la bat buoc, nhiem vu chi la "co thi tot".
  try {
    await taoNhiemVuNgay(input.familyId, input.dueDate, childIds);
  } catch (e) {
    console.error('Khong tao duoc dong nhiem vu cho ngay', input.dueDate, e);
  }

  return created;
}

/**
 * Tick xong / bo tick. PRD 4.3: tre tick nham phai bo duoc.
 *
 * @param startedAtMs  moc con bam "Bat dau lam" may con gui kem luc tick (epoch
 *   ms, da qua locMocBatDau trong lib/diem.ts), null neu khong gui.
 *
 * Moc do ghi TRONG CUNG cau UPDATE voi status, khong tach ra cau rieng o buoc
 * cong diem: no la bang chung DUY NHAT cua "xong som" va truoc luc gui chi nam
 * trong localStorage cua may con (may con xoa ngay sau khi tick thanh cong), nen
 * neu buoc cong diem loi giua duong thi moc phai da nam trong DB roi.
 *
 * Hai COALESCE cho phep tick lai nhieu lan ma khong lam xau di: `completed_at`
 * giu moc xong DAU TIEN (bam lai khong day no ra sau vai giay, con dang bi xet
 * "xong som" khong bi mat oan), `started_at` giu moc cu khi lan nay khong gui
 * gi. Bo tick thi xoa completed_at nhu cu, con started_at giu nguyen.
 */
export async function setStatus(
  familyId: string,
  id: string,
  done: boolean,
  startedAtMs: number | null = null
): Promise<Assignment | null> {
  if (done) {
    await query(
      `UPDATE assignments
          SET status = 'done',
              completed_at = COALESCE(completed_at, now()),
              started_at = COALESCE($3::timestamptz, started_at)
        WHERE id = $1 AND ${OF_FAMILY}`,
      [id, familyId, startedAtMs === null ? null : new Date(startedAtMs).toISOString()]
    );
  } else {
    await query(
      `UPDATE assignments SET status = 'todo', completed_at = NULL WHERE id = $1 AND ${OF_FAMILY}`,
      [id, familyId]
    );
  }
  return getAssignment(familyId, id);
}

export async function updateAssignment(
  familyId: string,
  id: string,
  patch: Partial<
    Pick<
      Assignment,
      'subject' | 'icon' | 'content' | 'note' | 'lang' | 'dueDate' | 'source'
      | 'durationMinutes' | 'requiresVideo'
    >
  > & {
    /** Co mat = THAY CA DANH SACH tep dinh kem cua bai bang danh sach nay. */
    media?: AttachedMedia[];
  }
): Promise<Assignment | null> {
  const map: Record<string, string> = {
    subject: 'subject', icon: 'icon', content: 'content',
    note: 'note', lang: 'lang', dueDate: 'due_date', source: 'source',
    durationMinutes: 'duration_minutes',
    requiresVideo: 'requires_video',
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

/**
 * Con nop video cho mot bai. Moi bai giu MOT video moi nhat: quay lai la thay
 * URL cu — tep cu tren Blob de nguyen (khong co API xoa o phia con), don sau
 * bang vong doi cua Blob store neu can.
 *
 * Duong nay KHONG can PIN (con khong dang nhap — PRD 4.5) nen chi nhan url,
 * khong cho sua bat ky truong nao khac.
 *
 * markDone: nop video CHINH LA hanh dong hoan thanh bai co yeu cau quay, nen hai
 * viec do phai vao CUNG MOT cau UPDATE. Tach thanh hai cau thi cau sau tach ra
 * loi giua duong (Neon rot ket noi) se de lai hang co video ma status van 'todo':
 * con bam gui lai la tai len them mot ban 35MB nua khong ai tro toi.
 *
 * startedAtMs vao cung cau do, cung ly do va cung hai COALESCE nhu setStatus.
 */
export async function submitVideo(
  familyId: string,
  id: string,
  url: string,
  markDone = false,
  startedAtMs: number | null = null
): Promise<Assignment | null> {
  await query(
    `UPDATE assignments
        SET submitted_video_url = $3, submitted_video_at = now()
            ${markDone
              ? `, status = 'done',
                   completed_at = COALESCE(completed_at, now()),
                   started_at = COALESCE($4::timestamptz, started_at)`
              : ''}
      WHERE id = $1 AND ${OF_FAMILY}`,
    markDone
      ? [id, familyId, url, startedAtMs === null ? null : new Date(startedAtMs).toISOString()]
      : [id, familyId, url]
  );
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
  /**
   * total / done dem GOP bai tap va nhiem vu hang ngay, khong tach hai loai —
   * luat chung cho moi con so tom tat, xem AGENTS.md. Rieng `overdue` loai dong
   * nhiem vu ra (mot nhiem vu cua hom qua khong phai "bai qua han").
   */
  total: number;
  done: number;
  overdue: number;
  /** So diem con DANG CO (da tru phan thuong bo me duyet) — xem soDiemTheoCon. */
  points: number;
}

/**
 * Bai TU HOM NAY TRO DI, khong phai rieng hom nay: bo me hay nhap bai vao toi
 * hom truoc cho ngay hom sau, dem moi hom nay thi bang dieu khien bao 0 trong
 * khi bai da nam san trong may. Man cua con cung liet ke tu hom nay tro di nen
 * hai ben phai dem giong nhau, khong thi badge "Chua co bai" ma mo ra van co bai.
 *
 * Nhiem vu moi ngay ("viec nha") gio la MOT DONG assignments THAT (issue #36,
 * nang cap #25/#30): khong con cong rieng tu daily_chores/daily_chore_checks
 * nua — dong viec nha da nam san trong cau truy van assignments duoi day, tu
 * dong cong vao total/done nhu bat ky bai tap nao khac. chua tick het viec nha
 * thi "done" khong duoi kip "total", giong dung tinh than cu.
 */
export async function progressUpcoming(familyId: string): Promise<ChildProgress[]> {
  const today = todayISO();
  // Tao dong nhiem vu HOM NAY cho ca nha truoc khi dem (issue #42): man chon-con
  // hien badge "Còn N việc" nen so phai dung ke ca ngay khong ai giao bai. Phai
  // cho xong roi moi dem — khong chay song song voi ba cau duoi.
  await taoNhiemVuNgay(familyId, today, null);
  // Ba cau chay SONG SONG (Neon la HTTP, moi cau mot vong goi). Bai da xong cua
  // nhung ngay truoc khong con y nghia -> chi lay bai sap toi va bai con no.
  // chore_id lay ve de loc `overdue` ben duoi. Diem lay kem o day vi ca hai man
  // goi ham nay (chon-con cua con, tong quan cua bo me) deu hien diem canh tien do.
  //
  // "Bai con no" chi tinh bai THAT (chore_id IS NULL): tu issue #42 moi ngay
  // sinh mot dong nhiem vu cho moi con, ngay nao con khong tick het thi dong do
  // nam lai 'todo' MAI MAI — vai nghin dong mot nam keo ve moi lan dung hai man
  // duoc mo nhieu nhat, ma khong dong nao vao duoc ket qua: `upcoming` loc theo
  // due_date, con `overdue` da loc chore_id IS NULL san.
  const [children, rows, diem] = await Promise.all([
    listChildren(familyId),
    query<{ child_id: string; status: string; due_date: string | Date; chore_id: string | null }>(
      `SELECT a.child_id, a.status, a.due_date, a.chore_id FROM assignments a
       JOIN children c ON c.id = a.child_id
       WHERE c.family_id = $1
         AND (a.due_date >= $2 OR (a.status = 'todo' AND a.chore_id IS NULL))`,
      [familyId, today]
    ),
    soDiemTheoCon(familyId),
  ]);

  return children.map((child) => {
    const mine = rows.filter((r) => r.child_id === child.id);
    const upcoming = mine.filter((r) => dateStr(r.due_date) >= today);
    return {
      child,
      total: upcoming.length,
      done: upcoming.filter((r) => r.status === 'done').length,
      // Qua han = han truoc hom nay ma van chua xong. Loai viec nha (chore_id
      // khong null) giong het nguyen tac cua listAssignments — mot nhiem vu cua
      // hom qua khong phai "bai qua han", va man bo me khong duoc thay no lam
      // phinh badge nay.
      overdue: mine.filter((r) => dateStr(r.due_date) < today && r.status === 'todo' && r.chore_id === null).length,
      points: diem.get(child.id) ?? 0,
    };
  });
}

/* ---------------- Nhiem vu hang ngay ("viec nha") ----------------
 *
 * MOT danh sach CAU HINH chung ca nha: bo me sua o man /bome/nhiem-vu-hang-ngay
 * (migrations/012, 016). Tu issue #36 day chi con la khuon: moi nhiem vu dang
 * bat sinh ra mot DONG assignments that cho moi (con duoc giao, ngay), va con
 * tick chinh dong do — bang daily_chore_checks khong con ai ghi vao nua. Tu
 * issue #42 dong do duoc tao LUOI moi ngay (taoNhiemVuNgay), moi nhiem vu co
 * sao / icon / nhom / danh sach con duoc giao.
 *
 * Ba trang thai, dung nham la mat du lieu: dang bat / tat (enabled = false, van
 * hien o Cai dat, bat lai duoc) / da bo (archived_at, an han, khong khoi phuc —
 * xem deleteChore va migrations/014_bo_viec_nha_thay_vi_xoa.sql).
 */

/**
 * Ba viec captain chot o issue #25. Nha moi tao duoc nap san ba viec nay; nha da
 * co tu truoc thi migration 012 nap. scripts/seed.mjs cheo lai danh sach nay
 * cho DB mau — doi o day thi doi ca ben do.
 */
export const VIEC_NHA_MAC_DINH = [
  'Cất sách vở vào ba lô',
  'Tắt đèn học',
  'Soạn sách vở cho ngày mai',
];

/**
 * Subject/icon co dinh cho DONG assignments sinh tu mot viec nha (issue #36,
 * xem saveSubmission). Khong dung de nhom o man cua con — nhom theo chore_id
 * co null hay khong (xem app/con/[childId]/page.tsx) — chi la gia tri hop le
 * cho hai cot NOT NULL cua assignments.
 */
export const VIEC_NHA_SUBJECT = 'Việc nhà';

/**
 * Tao dong assignments cho MOI nhiem vu dang bat x MOI con duoc giao, cho MOT
 * ngay — chi nhung dong chua co (issue #42, Q2: nhiem vu hien moi ngay, ke ca
 * cuoi tuan va ngay khong co bai, KHONG can cron).
 *
 * MOT cau INSERT ... SELECT ... ON CONFLICT DO NOTHING tren unique index
 * (child_id, due_date, chore_id) cua migrations/013: goi bao nhieu lan cung chi
 * tao moi dong mot lan, hai request mo man cung luc cung khong tao trung, va
 * khong can buoc SELECT-kiem-truoc nao. Khong co gi de chen thi la no-op re.
 *
 * Goi tu: man cua con (hom nay, con do), progressUpcoming (hom nay, ca nha —
 * man chon-con va tong quan bo me), man chi tiet con cua bo me, va
 * saveSubmission (ngay cua dot bai, cac con duoc giao — ke ca ngay mai). Ngay
 * khong ai mo man thi khong co dong cho ngay do — chap nhan: khong ai tick thi
 * cung khong co gi de ghi.
 *
 * CHEP stars/icon/content vao dong luc tao (tien le: content o 013, gia phan
 * thuong o 015): bo me sua cau hinh sau do chi anh huong dong tao SAU. Nhom thi
 * doc live (xem ASSIGNMENT_SELECT). Dong khong co submission_id (khong thuoc dot
 * nhap nao), source/duration lay mac dinh cho hai cot NOT NULL.
 *
 * Nhiem vu them giua ngay se xuat hien o lan mo man tiep theo (khong cho ngay
 * mai): dong moi la dong TAO MOI, khong sua dong da co, nen khong trai luat
 * "sua chi anh huong dong tao sau".
 *
 * scripts/seed.mjs nhan ban cau nay cho DB mau (script node khong import duoc
 * TypeScript) — doi o day thi doi ca ben do.
 *
 * @param childIds  null = moi con trong nha; hoac chi cac con nay (da loc theo
 *   nha o noi goi — cau SQL van JOIN children theo family_id nen id nha khac
 *   khong tao ra gi).
 */
export async function taoNhiemVuNgay(
  familyId: string,
  date: string,
  childIds: string[] | null
): Promise<void> {
  // id sinh trong SQL (md5 ngau nhien) vi so dong chi biet sau khi SELECT;
  // tien to 'asg_' + 16 hex de cung hinh dang voi newId('asg').
  await query(
    `INSERT INTO assignments
       (id, child_id, subject, icon, content, lang, due_date, source, duration_minutes,
        requires_video, chore_id, stars)
     SELECT 'asg_' || substr(md5(random()::text || c.id || dc.id || $2::text), 1, 16),
            c.id, $3, dc.icon, dc.content, 'vi', $2::date, $4, $5, false, dc.id, dc.stars
       FROM daily_chores dc
       JOIN children c ON c.family_id = dc.family_id
      WHERE dc.family_id = $1 AND dc.enabled AND dc.archived_at IS NULL
        AND (dc.child_ids IS NULL OR c.id = ANY(dc.child_ids))
        AND ($6::text[] IS NULL OR c.id = ANY($6::text[]))
     ON CONFLICT (child_id, due_date, chore_id) WHERE chore_id IS NOT NULL DO NOTHING`,
    [familyId, date, VIEC_NHA_SUBJECT, HW_SOURCE_DEFAULT, DURATION_DEFAULT, childIds]
  );
}

/**
 * Loc "giao cho" tu body API: undefined/null -> null (CA NHA); mang -> chi giu id
 * con CUA NHA NAY, bo trung. Tra ve chuoi loi neu mang rong hoac co id la — bo
 * me phai giao cho it nhat mot con, va id con nha khac khong duoc lot vao cau
 * hinh (dung o POST va PATCH /api/viec-nha; dat o day vi route file cua Next
 * khong duoc export ham ngoai cac method HTTP).
 */
export async function locChildIdsGiaoCho(
  familyId: string,
  v: unknown
): Promise<{ childIds: string[] | null } | { error: string }> {
  if (v === undefined || v === null) return { childIds: null };
  if (!Array.isArray(v)) return { error: 'Danh sách con không hợp lệ.' };
  const mine = new Set((await listChildren(familyId)).map((c) => c.id));
  const ids = [...new Set(v.map(String))];
  if (ids.length === 0) return { error: 'Chưa giao cho ai — chọn "Cả nhà" hoặc ít nhất một con.' };
  if (ids.some((id) => !mine.has(id))) return { error: 'Có con không thuộc nhà mình.' };
  return { childIds: ids };
}

interface ChoreRow {
  id: string; content: string; icon: string; stars: number | string; category: string;
  child_ids: string[] | null; sort_order: number; enabled: boolean;
}

const CHORE_COLS = 'id, content, icon, stars, category, child_ids, sort_order, enabled';

const toChore = (r: ChoreRow): DailyChore => ({
  id: r.id,
  content: r.content,
  icon: r.icon,
  stars: Number(r.stars),
  nhom: nhomNhiemVuOf(r.category),
  childIds: r.child_ids === null ? null : [...r.child_ids],
  sortOrder: Number(r.sort_order),
  enabled: Boolean(r.enabled),
});

/**
 * Viec da BO (archived_at khong null) bi loai o day va o getChore, tuc o MOI
 * duong doc — ke ca luot enabledOnly ma saveSubmission dung de tao dong viec nha
 * cho mot ngay moi. Khac voi "tat" (enabled = false): tat thi van hien o man Cai
 * dat va bat lai duoc. Xem migrations/014_bo_viec_nha_thay_vi_xoa.sql.
 */
export async function listChores(
  familyId: string,
  opts: { enabledOnly?: boolean } = {}
): Promise<DailyChore[]> {
  const rows = await query<ChoreRow>(
    `SELECT ${CHORE_COLS} FROM daily_chores
      WHERE family_id = $1 AND archived_at IS NULL ${opts.enabledOnly ? 'AND enabled' : ''}
      ORDER BY sort_order ASC, created_at ASC, id ASC`,
    [familyId]
  );
  return rows.map(toChore);
}

/**
 * Nap ba viec mac dinh cho mot nha vua tao. Sao / icon / nhom / giao cho lay
 * DEFAULT cua DB (1 ⭐, 🧹, "Sau khi hoc xong", ca nha — migrations/016), giong
 * het ba dong cua nha da co tu truoc.
 */
export async function seedDefaultChores(familyId: string): Promise<void> {
  for (const [i, content] of VIEC_NHA_MAC_DINH.entries()) {
    await query(
      `INSERT INTO daily_chores (id, family_id, content, sort_order) VALUES ($1,$2,$3,$4)`,
      [newId('chr'), familyId, content, i + 1]
    );
  }
}

/**
 * Them mot nhiem vu vao cuoi danh sach. childIds da phai duoc noi goi loc theo
 * nha (API kiem: mang rong -> 400, id la -> 400); null = ca nha.
 */
export async function createChore(
  familyId: string,
  input: { content: string; icon: string; stars: number; nhom: NhomNhiemVu; childIds: string[] | null }
): Promise<DailyChore> {
  const row = await queryOne<{ n: number | string | null }>(
    `SELECT MAX(sort_order) AS n FROM daily_chores WHERE family_id = $1`,
    [familyId]
  );
  const id = newId('chr');
  await query(
    `INSERT INTO daily_chores (id, family_id, content, icon, stars, category, child_ids, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, familyId, input.content, input.icon, input.stars, input.nhom, input.childIds,
     Number(row?.n ?? 0) + 1]
  );
  return (await getChore(familyId, id))!;
}

/**
 * Tra null neu viec nay thuoc nha khac — dung lam luon lop kiem tra so huu.
 *
 * Viec da bo cung tra null: voi bo me no khong con ton tai (khong hien o Cai dat,
 * khong co nut khoi phuc), nen sua/bo lai no qua API phai la 404 chu khong duoc
 * am tham doi noi dung mot dong ma khong man nao hien ra.
 */
export async function getChore(familyId: string, id: string): Promise<DailyChore | null> {
  const r = await queryOne<ChoreRow>(
    `SELECT ${CHORE_COLS} FROM daily_chores
      WHERE id = $1 AND family_id = $2 AND archived_at IS NULL`,
    [id, familyId]
  );
  return r ? toChore(r) : null;
}

/**
 * Sua cau hinh mot nhiem vu. CHI anh huong dong tao SAU do: dong cua hom nay da
 * tao giu content/icon/stars cu (da chep luc tao), diem da ghi giu nguyen. Rieng
 * nhom doc live nen dong hom nay doi nhom theo (xem ASSIGNMENT_SELECT).
 * childIds: null = ca nha; mang -> chi cac con do (API da kiem thuoc nha).
 */
export async function updateChore(
  familyId: string,
  id: string,
  patch: {
    content?: string; icon?: string; stars?: number; nhom?: NhomNhiemVu;
    childIds?: string[] | null; enabled?: boolean;
  }
): Promise<DailyChore | null> {
  const sets: string[] = [];
  const params: unknown[] = [id, familyId];

  if (patch.content !== undefined) { params.push(patch.content); sets.push(`content = $${params.length}`); }
  if (patch.icon !== undefined)    { params.push(patch.icon);    sets.push(`icon = $${params.length}`); }
  if (patch.stars !== undefined)   { params.push(patch.stars);   sets.push(`stars = $${params.length}`); }
  if (patch.nhom !== undefined)    { params.push(patch.nhom);    sets.push(`category = $${params.length}`); }
  if (patch.childIds !== undefined) {
    params.push(patch.childIds);
    sets.push(`child_ids = $${params.length}::text[]`);
  }
  if (patch.enabled !== undefined) { params.push(patch.enabled); sets.push(`enabled = $${params.length}`); }

  if (sets.length) {
    await query(
      `UPDATE daily_chores SET ${sets.join(', ')} WHERE id = $1 AND family_id = $2`,
      params
    );
  }
  return getChore(familyId, id);
}

/**
 * DANH DAU DA BO, khong xoa dong that: xoa that se keo theo chore_id cua moi
 * dong assignments sinh tu viec nay ve NULL (ON DELETE SET NULL, migrations/013),
 * bien chung thanh BAI TAP THAT — lot vao danh sach bai cua con va vao badge
 * "Qua han" cua bo me. Xem migrations/014_bo_viec_nha_thay_vi_xoa.sql.
 *
 * Sau lenh nay listChores/getChore khong con tra ve viec do nua, nen no bien mat
 * khoi man Cai dat va khong duoc dung de tao dong cho cac ngay sau.
 */
export async function deleteChore(familyId: string, id: string): Promise<void> {
  await query(
    `UPDATE daily_chores SET archived_at = now()
      WHERE id = $1 AND family_id = $2 AND archived_at IS NULL`,
    [id, familyId]
  );
}

/**
 * Doi cho mot viec voi viec ngay tren (huong -1) hoac ngay duoi (huong +1).
 *
 * Danh so lai CA danh sach thay vi hoan doi hai gia tri sort_order: du lieu cu co
 * the co hai dong trung so (mac dinh 0), hoan doi thi thu tu khong nhuc nhich ma
 * bo me khong hieu vi sao. Danh lai 1..n mot the la het chuyen.
 */
export async function moveChore(familyId: string, id: string, huong: -1 | 1): Promise<void> {
  const list = await listChores(familyId);
  const i = list.findIndex((c) => c.id === id);
  const j = i + huong;
  if (i < 0 || j < 0 || j >= list.length) return;

  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, c] of list.entries()) {
    await query(
      `UPDATE daily_chores SET sort_order = $3 WHERE id = $1 AND family_id = $2`,
      [c.id, familyId, k + 1]
    );
  }
}


/* ---------------- Diem thuong & doi thuong ----------------
 *
 * Luat o lib/diem.ts, luoc do o migrations/015_tinh_diem_doi_thuong.sql va 016.
 * Tom tat: +10 mot ngay xong het (mot lan cho moi (con, ngay)), +1 moi bai xong
 * som hon thoi luong du kien, +stars moi dong nhiem vu tick xong (mot lan cho
 * moi dong), khong hoi to truoc families.score_since. So du = tong score_events
 * - tong reward_redemptions da duyet.
 *
 * score_events va reward_redemptions khong co family_id: thuoc nha nao la qua
 * child_id -> children.family_id (nhu assignments), nen moi cau deu join/loc
 * qua children.
 */

/** So diem DANG CO cua tung con trong nha: kiem duoc tru di da doi (bo me duyet). */
export async function soDiemTheoCon(familyId: string): Promise<Map<string, number>> {
  const rows = await query<{ id: string; points: number | string }>(
    `SELECT c.id,
            COALESCE((SELECT SUM(e.points) FROM score_events e WHERE e.child_id = c.id), 0)
          - COALESCE((SELECT SUM(r.cost) FROM reward_redemptions r
                       WHERE r.child_id = c.id AND r.status = 'approved'), 0) AS points
       FROM children c
      WHERE c.family_id = $1`,
    [familyId]
  );
  return new Map(rows.map((r) => [r.id, Number(r.points)]));
}

export async function soDiem(familyId: string, childId: string): Promise<number> {
  return (await soDiemTheoCon(familyId)).get(childId) ?? 0;
}

/** Ngay nay (due_date) cua con nay da duoc cong 10 diem "ngay xong" chua. */
export async function daCongDiemNgay(familyId: string, childId: string, date: string): Promise<boolean> {
  const r = await queryOne<{ id: string }>(
    `SELECT e.id FROM score_events e
       JOIN children c ON c.id = e.child_id
      WHERE c.family_id = $1 AND e.child_id = $2 AND e.kind = 'day_complete' AND e.event_date = $3`,
    [familyId, childId, date]
  );
  return r !== null;
}

/**
 * Xet mot NGAY cua mot con: neu moi dong cua (con, ngay) da 'done' (ngayHoanThanh
 * trong lib/diem.ts) va ngay do duoc tinh diem thi cong +DIEM_NGAY_XONG.
 *
 * IDEMPOTENT: unique index partial cua migration 015 + ON CONFLICT DO NOTHING,
 * doc RETURNING de biet lan nay co cong THAT hay khong. Goi lai bao nhieu lan
 * cung khong cong trung, nen moi thao tac co the lam mot ngay thanh hoan thanh
 * deu goi duoc: con tick bai cuoi (ghiDiemSauKhiXong), va bo me BOT viec cua
 * ngay do — xoa bai (DELETE /api/assignments/:id) hay doi dueDate sang ngay khac
 * (PATCH cua bo me, xet cho ngay CU). Khong co no thi ngay con lam xong that
 * nhung dong cuoi bi bo me xoa se khong bao gio duoc cong.
 *
 * @returns ngayXong    DIEM_NGAY_XONG neu VUA cong o lan nay, 0 neu khong.
 * @returns ngayTinhDiem  ngay nay co duoc tinh diem khong (khong hoi to) — de
 *   nguoi goi khoi phai doc lai families.score_since bang mot vong thua nua.
 */
export async function congDiemNgayNeuXong(
  familyId: string,
  childId: string,
  dueDate: string
): Promise<{ ngayXong: number; ngayTinhDiem: boolean }> {
  // Mot cau cho ca hai viec: cac dong cua (con, ngay) de xet "ngay xong", va
  // families.score_since de xet "khong hoi to" (lib/diem.ts). Neon tinh tien
  // theo vong thua nen khong doc family bang mot cau rieng.
  const rows = await query<{ status: string; chore_id: string | null; score_since: string | Date }>(
    `SELECT a.status, a.chore_id, f.score_since
       FROM assignments a
       JOIN children c ON c.id = a.child_id
       JOIN families f ON f.id = c.family_id
      WHERE a.child_id = $1 AND a.due_date = $2 AND c.family_id = $3`,
    [childId, dueDate, familyId]
  );
  // Khong con dong nao (bo me xoa het bai cua ngay do, hay con khong thuoc nha
  // nay) -> khong co "ngay xong" nao de cong.
  if (rows.length === 0) return { ngayXong: 0, ngayTinhDiem: false };

  const ngayTinhDiem = ngayDuocTinhDiem(dueDate, dateStr(rows[0].score_since));
  if (!ngayTinhDiem) return { ngayXong: 0, ngayTinhDiem: false };
  if (!ngayHoanThanh(rows.map((r) => ({ status: r.status, choreId: r.chore_id })))) {
    return { ngayXong: 0, ngayTinhDiem };
  }

  const ins = await query<{ id: string }>(
    `INSERT INTO score_events (id, child_id, kind, points, event_date)
     VALUES ($1, $2, 'day_complete', $3, $4)
     ON CONFLICT (child_id, event_date) WHERE kind = 'day_complete' DO NOTHING
     RETURNING id`,
    [newId('sce'), childId, DIEM_NGAY_XONG, dueDate]
  );
  return { ngayXong: ins.length > 0 ? DIEM_NGAY_XONG : 0, ngayTinhDiem };
}

/**
 * Cong diem cho mot bai dang 'done' (PATCH /api/assignments/:id, duong cua con).
 * Goi voi bai da doc lai tu DB sau khi setStatus / submitVideo cap nhat.
 *
 * KHONG ghi gi vao assignments: hai moc de xet "xong som" (started_at,
 * completed_at) do setStatus / submitVideo luu san trong cung cau UPDATE danh
 * dau xong, ham nay chi DOC tu `a`. Nho vay moc song sot moi loi o day.
 *
 * IDEMPOTENT — goi lai bao nhieu lan cung khong cong trung: ca hai lan INSERT
 * deu ON CONFLICT DO NOTHING tren unique index cua migration 015 va doc
 * RETURNING de biet co cong THAT hay khong. Nho vay route goi ham nay o MOI
 * PATCH cua con ma bai dang 'done' (khong chi luc vua chuyen todo -> done):
 * lan truoc ghi diem loi giua duong (Neon rot ket noi) thi con bam lai la cong
 * not phan con thieu. Cac lan goi lai tra ve xongSom/ngayXong = 0, dung nghia
 * "VUA cong o lan nay".
 *
 * Khong tru diem khi con bo tick ("Chua lam xong") sau khi da duoc cong — MVP
 * chap nhan lach nho trong nha; bo me sua/xoa bai cua mot ngay da cong cung
 * khong lam mat diem (khong co gi tru).
 */
export async function ghiDiemSauKhiXong(familyId: string, a: Assignment): Promise<DiemVuaCong> {
  const ketQua: DiemVuaCong = { xongSom: 0, ngayXong: 0, nhiemVu: 0 };
  if (a.status !== 'done') return ketQua;

  // 1. Ngay xong — ca bai tap lan viec nha cua (con, ngay) deu done. Tra ve kem
  //    ngayTinhDiem de nhanh "xong som" duoi day dung lai, khong doc score_since
  //    lan hai.
  const ngay = await congDiemNgayNeuXong(familyId, a.childId, a.dueDate);
  ketQua.ngayXong = ngay.ngayXong;

  // 2. Xong som — chi bai tap that: viec nha (chore_id khong null) tick tai cho,
  //    khong co dong ho, khong bao gio duoc +1.
  const mocBatDau = a.startedAt === null ? null : new Date(a.startedAt).getTime();
  const mocXong = a.completedAt === null ? Date.now() : new Date(a.completedAt).getTime();
  if (ngay.ngayTinhDiem && mocBatDau !== null && a.choreId === null &&
      xongSom(mocBatDau, mocXong, a.durationMinutes)) {
    const ins = await query<{ id: string }>(
      `INSERT INTO score_events (id, child_id, kind, points, event_date, assignment_id)
       VALUES ($1, $2, 'early_finish', $3, $4, $5)
       ON CONFLICT (assignment_id) WHERE kind = 'early_finish' DO NOTHING
       RETURNING id`,
      [newId('sce'), a.childId, DIEM_XONG_SOM, a.dueDate, a.id]
    );
    if (ins.length > 0) ketQua.xongSom = DIEM_XONG_SOM;
  }

  // 3. Sao cua NHIEM VU (issue #42): dong viec nha CO sao (a.stars, chep luc
  //    tao) tick xong duoc dung so sao do, cong THEM vao +10/+1 o tren. Dong
  //    viec nha cu (stars null — tao truoc migration 016) khong bao gio duoc:
  //    khong hoi to. "Cong mot lan" la unique index score_events_task_once_idx
  //    (assignment_id, kind = 'task_done') — tick lai, bo tick roi tick lai,
  //    hai request cung luc deu chi mot dong. Bo tick khong rut (Q6).
  if (ngay.ngayTinhDiem && a.choreId !== null && a.stars !== null && a.stars > 0) {
    const ins = await query<{ id: string }>(
      `INSERT INTO score_events (id, child_id, kind, points, event_date, assignment_id)
       VALUES ($1, $2, 'task_done', $3, $4, $5)
       ON CONFLICT (assignment_id) WHERE kind = 'task_done' DO NOTHING
       RETURNING id`,
      [newId('sce'), a.childId, a.stars, a.dueDate, a.id]
    );
    if (ins.length > 0) ketQua.nhiemVu = a.stars;
  }

  // So du chi doc khi lan nay CO cong diem: man cua con chi hien "Con dang co N
  // ⭐" cung voi chip +1 / +N sao, khong cong gi thi khong ai doc so do (bo mot
  // vong thua Neon cho moi cu tick khong duoc gi).
  if (ketQua.xongSom > 0 || ketQua.ngayXong > 0 || ketQua.nhiemVu > 0) {
    ketQua.tong = await soDiem(familyId, a.childId);
  }
  return ketQua;
}

/* ---- Phan thuong (bo me cau hinh) ---- */

interface RewardRow { id: string; name: string; icon: string; cost: number | string; enabled: boolean }

const toReward = (r: RewardRow): Reward => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  cost: Number(r.cost),
  enabled: Boolean(r.enabled),
});

const REWARD_COLS = 'id, name, icon, cost, enabled';

/** Sap theo gia tang dan: cua hang cua con hien thu re (de voi) truoc. */
export async function listRewards(
  familyId: string,
  opts: { enabledOnly?: boolean } = {}
): Promise<Reward[]> {
  const rows = await query<RewardRow>(
    `SELECT ${REWARD_COLS} FROM rewards
      WHERE family_id = $1 ${opts.enabledOnly ? 'AND enabled' : ''}
      ORDER BY cost ASC, created_at ASC, id ASC`,
    [familyId]
  );
  return rows.map(toReward);
}

/** Tra null neu phan thuong thuoc nha khac — dung lam luon lop kiem tra so huu. */
export async function getReward(familyId: string, id: string): Promise<Reward | null> {
  const r = await queryOne<RewardRow>(
    `SELECT ${REWARD_COLS} FROM rewards WHERE id = $1 AND family_id = $2`,
    [id, familyId]
  );
  return r ? toReward(r) : null;
}

export async function createReward(
  familyId: string,
  input: { name: string; icon: string; cost: number }
): Promise<Reward> {
  const id = newId('rwd');
  await query(
    `INSERT INTO rewards (id, family_id, name, icon, cost) VALUES ($1,$2,$3,$4,$5)`,
    [id, familyId, input.name, input.icon, input.cost]
  );
  return (await getReward(familyId, id))!;
}

export async function updateReward(
  familyId: string,
  id: string,
  patch: Partial<Pick<Reward, 'name' | 'icon' | 'cost' | 'enabled'>>
): Promise<Reward | null> {
  const sets: string[] = [];
  const params: unknown[] = [id, familyId];
  for (const col of ['name', 'icon', 'cost', 'enabled'] as const) {
    const v = patch[col];
    if (v !== undefined) { params.push(v); sets.push(`${col} = $${params.length}`); }
  }
  if (sets.length) {
    await query(`UPDATE rewards SET ${sets.join(', ')} WHERE id = $1 AND family_id = $2`, params);
  }
  return getReward(familyId, id);
}

/**
 * Xoa that (khac viec nha): reward_redemptions da CHEP ten/icon/gia luc con xin
 * va reward_id ON DELETE SET NULL, nen yeu cau dang cho va lich su van doc
 * duoc nguyen ven, khong co gi bi keo theo.
 */
export async function deleteReward(familyId: string, id: string): Promise<void> {
  await query(`DELETE FROM rewards WHERE id = $1 AND family_id = $2`, [id, familyId]);
}

/* ---- Doi thuong (con xin, bo me duyet) ---- */

interface RedemptionRow {
  id: string; child_id: string; reward_id: string | null; reward_name: string; reward_icon: string;
  cost: number | string; status: string; requested_at: string | Date; decided_at: string | Date | null;
}

const toRedemption = (r: RedemptionRow): Redemption => ({
  id: r.id,
  childId: r.child_id,
  rewardId: r.reward_id,
  rewardName: r.reward_name,
  rewardIcon: r.reward_icon,
  cost: Number(r.cost),
  status: r.status as RedemptionStatus,
  requestedAt: new Date(r.requested_at).toISOString(),
  decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
});

/** Loc "yeu cau nay thuoc nha do" — bang khong co family_id, di qua children. */
const REDEMPTION_OF_FAMILY = `r.child_id IN (SELECT id FROM children WHERE family_id = $2)`;

export async function getRedemption(familyId: string, id: string): Promise<Redemption | null> {
  const r = await queryOne<RedemptionRow>(
    `SELECT r.* FROM reward_redemptions r WHERE r.id = $1 AND ${REDEMPTION_OF_FAMILY}`,
    [id, familyId]
  );
  return r ? toRedemption(r) : null;
}

/** Moi nhat truoc. */
export async function listRedemptions(
  familyId: string,
  opts: { childId?: string; status?: RedemptionStatus; limit?: number } = {}
): Promise<Redemption[]> {
  const where: string[] = ['c.family_id = $1'];
  const params: unknown[] = [familyId];
  if (opts.childId) { params.push(opts.childId); where.push(`r.child_id = $${params.length}`); }
  if (opts.status)  { params.push(opts.status);  where.push(`r.status = $${params.length}`); }
  params.push(opts.limit ?? 50);
  const rows = await query<RedemptionRow>(
    `SELECT r.* FROM reward_redemptions r
       JOIN children c ON c.id = r.child_id
      WHERE ${where.join(' AND ')}
      ORDER BY r.requested_at DESC, r.id DESC
      LIMIT $${params.length}`,
    params
  );
  return rows.map(toRedemption);
}

export async function countPendingRedemptions(familyId: string): Promise<number> {
  const r = await queryOne<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM reward_redemptions r
       JOIN children c ON c.id = r.child_id
      WHERE c.family_id = $1 AND r.status = 'pending'`,
    [familyId]
  );
  return Number(r?.n ?? 0);
}

export type KetQuaDoiThuong =
  | { ok: true; redemption: Redemption }
  | { ok: false; status: number; error: string };

/**
 * Con xin doi mot phan thuong (duong KHONG can PIN, xac thuc bang cookie thiet
 * bi nhu tick bai). Chi xin duoc khi: phan thuong dang bat, con chua co yeu cau
 * nao dang cho, va du diem. Diem CHUA bi tru — bo me duyet moi tru
 * (duyetDoiThuong). Loi tra ve bang chu tieng Viet cho con doc/nghe duoc.
 *
 * Unique index reward_redemptions_pending_once_idx la chot cuoi cho "mot yeu cau
 * dang cho": hai lan bam lien tay cung qua buoc SELECT kiem tra truoc khi ben
 * nao kip ghi thi lan sau vap unique -> tra 409 giong nhu da kiem thay.
 */
export async function xinDoiThuong(
  familyId: string,
  childId: string,
  rewardId: string
): Promise<KetQuaDoiThuong> {
  const child = await getChild(familyId, childId);
  if (!child) return { ok: false, status: 404, error: 'Không tìm thấy con này.' };

  const reward = await getReward(familyId, rewardId);
  if (!reward || !reward.enabled) {
    return { ok: false, status: 404, error: 'Phần thưởng này không còn nữa.' };
  }

  const dangCho = await listRedemptions(familyId, { childId, status: 'pending', limit: 1 });
  if (dangCho.length > 0) {
    return { ok: false, status: 409, error: 'Con đang có một yêu cầu chờ bố mẹ duyệt rồi.' };
  }

  const diem = await soDiem(familyId, childId);
  if (diem < reward.cost) {
    return { ok: false, status: 400, error: `Con còn thiếu ${reward.cost - diem} điểm nữa.` };
  }

  const id = newId('rdm');
  try {
    await query(
      `INSERT INTO reward_redemptions (id, child_id, reward_id, reward_name, reward_icon, cost)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, childId, reward.id, reward.name, reward.icon, reward.cost]
    );
  } catch (e) {
    if (/duplicate key|23505|pending_once/i.test(e instanceof Error ? e.message : String(e))) {
      return { ok: false, status: 409, error: 'Con đang có một yêu cầu chờ bố mẹ duyệt rồi.' };
    }
    throw e;
  }
  return { ok: true, redemption: (await getRedemption(familyId, id))! };
}

/**
 * Bo me duyet / tu choi. Duyet thi diem bi tru NGAY: so du doc tu status =
 * 'approved' (soDiemTheoCon), khong ghi them dong nao — mot cau UPDATE duy nhat,
 * khong co buoc thu hai de lech nhau. Kiem du diem lai luc duyet (khong chi luc
 * con xin) lam chot cuoi cho so du am, vi re va vi luat co the doi sau nay.
 */
export async function duyetDoiThuong(
  familyId: string,
  id: string,
  approve: boolean
): Promise<KetQuaDoiThuong> {
  const r = await getRedemption(familyId, id);
  if (!r) return { ok: false, status: 404, error: 'Không tìm thấy yêu cầu này.' };
  if (r.status !== 'pending') {
    return { ok: false, status: 409, error: 'Yêu cầu này đã được xử lý rồi.' };
  }
  if (approve) {
    const diem = await soDiem(familyId, r.childId);
    if (diem < r.cost) {
      return {
        ok: false, status: 400,
        error: `Con chỉ còn ${diem} điểm, chưa đủ ${r.cost} điểm. Bố mẹ có thể từ chối để con chọn lại.`,
      };
    }
  }
  const rows = await query<RedemptionRow>(
    `UPDATE reward_redemptions r SET status = $3, decided_at = now()
      WHERE r.id = $1 AND r.status = 'pending' AND ${REDEMPTION_OF_FAMILY}
      RETURNING r.*`,
    [id, familyId, approve ? 'approved' : 'rejected']
  );
  if (rows.length === 0) return { ok: false, status: 409, error: 'Yêu cầu này đã được xử lý rồi.' };
  return { ok: true, redemption: toRedemption(rows[0]) };
}
