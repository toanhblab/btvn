import { NextResponse } from 'next/server';
import { isParent } from '@/lib/auth';
import { deleteAssignment, getAssignment, setStatus, updateAssignment } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/assignments/:id
 *   { status: 'done' | 'todo' }            -> con tick / bo tick, KHONG can PIN
 *   { subject?, content?, note?, lang?, dueDate? } -> bo me sua, CAN PIN
 *
 * Tach hai duong nhu vay vi tre khong dang nhap (PRD 4.5) nhung cung khong
 * duoc phep sua noi dung de bai.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dữ liệu không đọc được.' }, { status: 400 });

  const existing = await getAssignment(id);
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy bài tập.' }, { status: 404 });

  // Chi doi trang thai -> cho phep khong can PIN
  const keys = Object.keys(body);
  if (keys.length === 1 && keys[0] === 'status') {
    if (body.status !== 'done' && body.status !== 'todo') {
      return NextResponse.json({ error: 'Trạng thái không hợp lệ.' }, { status: 400 });
    }
    return NextResponse.json({ assignment: await setStatus(id, body.status === 'done') });
  }

  if (!(await isParent())) {
    return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });
  }
  return NextResponse.json({ assignment: await updateAssignment(id, body) });
}

/** DELETE /api/assignments/:id — chi bo me. */
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isParent())) {
    return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });
  }
  const { id } = await params;
  await deleteAssignment(id);
  return NextResponse.json({ ok: true });
}
