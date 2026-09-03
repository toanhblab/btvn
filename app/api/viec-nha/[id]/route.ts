import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { deleteChore, getChore, listChores, moveChore, updateChore } from '@/lib/store';
import { MAX_CHU_VIEC_NHA } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/viec-nha/:id — sua mot viec nha. CAN PIN.
 *
 *   { content }        doi chu
 *   { enabled }        bat / tat (tat thi con khong thay nua, tick cu van con)
 *   { move: 'len' | 'xuong' }  doi cho voi viec ngay tren / ngay duoi
 *
 * getChore loc theo nha nen viec cua nha khac tra 404 — biet id cung khong sua
 * duoc danh sach nha nguoi ta.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dữ liệu không đọc được.' }, { status: 400 });

  if (!(await getChore(familyId, id))) {
    return NextResponse.json({ error: 'Không tìm thấy việc này.' }, { status: 404 });
  }

  if (body.move !== undefined) {
    if (body.move !== 'len' && body.move !== 'xuong') {
      return NextResponse.json({ error: 'Hướng di chuyển không hợp lệ.' }, { status: 400 });
    }
    await moveChore(familyId, id, body.move === 'len' ? -1 : 1);
    return NextResponse.json({ chores: await listChores(familyId) });
  }

  const patch: Parameters<typeof updateChore>[2] = {};

  if (body.content !== undefined) {
    const content = String(body.content).trim();
    if (!content) return NextResponse.json({ error: 'Chưa nhập việc gì.' }, { status: 400 });
    if (content.length > MAX_CHU_VIEC_NHA) {
      return NextResponse.json({ error: 'Việc dài quá, để ngắn thôi cho con đọc được.' }, { status: 400 });
    }
    patch.content = content;
  }

  if (body.enabled !== undefined) patch.enabled = body.enabled === true;

  return NextResponse.json({ chore: await updateChore(familyId, id, patch) });
}

/**
 * DELETE /api/viec-nha/:id — xoa han mot viec. CAN PIN.
 *
 * Nhung lan con da tick viec nay di theo (ON DELETE CASCADE) nen giao dien phai
 * hoi lai truoc khi goi.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const { id } = await params;
  if (!(await getChore(familyId, id))) {
    return NextResponse.json({ error: 'Không tìm thấy việc này.' }, { status: 404 });
  }

  await deleteChore(familyId, id);
  return NextResponse.json({ ok: true });
}
