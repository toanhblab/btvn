import { NextResponse } from 'next/server';
import { parentFamilyId, viewingFamilyId } from '@/lib/auth';
import { deleteAllAssignments, listAssignments, saveSubmission, todayISO } from '@/lib/store';
import type { DraftAssignment } from '@/lib/types';
import { hwSourceOf, iconFor } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assignments?childId=...&date=2026-08-18
 *     ...?childId=...&from=...&to=...
 *
 * Khong can PIN — man cua tre phai doc duoc ma khong dang nhap (PRD 4.5) — nhung
 * phai biet la nha nao, va chi tra ve bai cua nha do.
 */
export async function GET(req: Request) {
  const familyId = await viewingFamilyId();
  if (!familyId) {
    return NextResponse.json({ error: 'Máy này chưa gắn với nhà nào.' }, { status: 401 });
  }

  const q = new URL(req.url).searchParams;
  const assignments = await listAssignments(familyId, {
    childId: q.get('childId') ?? undefined,
    date: q.get('date') ?? undefined,
    from: q.get('from') ?? undefined,
    to: q.get('to') ?? undefined,
  });
  return NextResponse.json({ assignments });
}

/**
 * POST /api/assignments — luu ca dot sau khi bo me duyet o man "Kiem tra lai".
 * CAN PIN: chi bo me duoc them bai.
 *
 * Body: { childIds: string[], dueDate, source?, rawText?, imageUrls?, drafts: DraftAssignment[] }
 * "source" la noi giao (lop tieng Anh / truong tieu hoc) cho CA dot — thieu hoac
 * la thi coi la truong tieu hoc.
 * Mot lan goi sinh ra bai RIENG cho tung con trong childIds (PRD 4.2 — hai be
 * sinh doi hoc cung lop, nhap mot lan ra bai cho ca hai).
 *
 * childIds duoc loc lai theo nha trong saveSubmission.
 */
export async function POST(req: Request) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dữ liệu gửi lên không đọc được.' }, { status: 400 });

  const childIds: string[] = Array.isArray(body.childIds) ? body.childIds : [];
  const drafts: DraftAssignment[] = Array.isArray(body.drafts) ? body.drafts : [];

  if (childIds.length === 0) {
    return NextResponse.json({ error: 'Chưa chọn con nào.' }, { status: 400 });
  }
  if (drafts.length === 0) {
    return NextResponse.json({ error: 'Chưa có bài tập nào để lưu.' }, { status: 400 });
  }

  const created = await saveSubmission({
    familyId,
    rawText: body.rawText ?? null,
    imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
    childIds,
    dueDate: body.dueDate || todayISO(),
    source: hwSourceOf(body.source),
    drafts: drafts.map((d) => ({
      subject: d.subject || 'Khác',
      icon: d.icon || iconFor(d.subject || 'Khác'),
      content: d.content,
      note: d.note || null,
      lang: d.lang === 'en' ? 'en' : 'vi',
      confidence: d.confidence ?? 1,
      // Tep dinh kem: chi giu phan tu co url that; kind la thi khong doan bua,
      // coi nhu video de it nhat con trinh phat de bam
      media: (Array.isArray(d.media) ? d.media : [])
        .filter((m) => typeof m?.url === 'string' && m.url.length > 0)
        .map((m) => ({
          url: m.url,
          name: typeof m.name === 'string' ? m.name : '',
          kind: m.kind === 'audio' || m.kind === 'image' ? m.kind : 'video',
        })),
    })),
  });

  if (created.length === 0) {
    return NextResponse.json({ error: 'Không lưu được: các con đã chọn không thuộc nhà này.' }, { status: 400 });
  }

  return NextResponse.json({ created, count: created.length });
}

/**
 * DELETE /api/assignments — xoa sach bai tap CUA NHA NAY. CAN PIN.
 *
 * Khong the hoan tac nen giao dien phai hoi lai truoc khi goi (xem XoaTatCa).
 * Con khong bao gio goi duoc duong nay: PIN chi bo me co (PRD 4.5).
 */
export async function DELETE() {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const deleted = await deleteAllAssignments(familyId);
  return NextResponse.json({ ok: true, deleted });
}
