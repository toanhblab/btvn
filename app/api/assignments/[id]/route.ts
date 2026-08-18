import { NextResponse } from 'next/server';
import { parentFamilyId, viewingFamilyId } from '@/lib/auth';
import { deleteAssignment, getAssignment, setStatus, updateAssignment } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/assignments/:id
 *   { status: 'done' | 'todo' }                    -> con tick / bo tick, KHONG can PIN
 *   { subject?, content?, note?, lang?, dueDate? } -> bo me sua, CAN PIN
 *
 * Tach hai duong nhu vay vi tre khong dang nhap (PRD 4.5) nhung cung khong duoc
 * phep sua noi dung de bai.
 *
 * Ca hai duong deu phai thuoc dung nha: duong tick khong can PIN nhung van can
 * may da gan voi nha do, khong thi con nha nay tick duoc bai nha khac neu doan
 * ra id.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dữ liệu không đọc được.' }, { status: 400 });

  // Chi doi trang thai -> cho phep khong can PIN
  const keys = Object.keys(body);
  if (keys.length === 1 && keys[0] === 'status') {
    const familyId = await viewingFamilyId();
    if (!familyId) {
      return NextResponse.json({ error: 'Máy này chưa gắn với nhà nào.' }, { status: 401 });
    }
    if (!(await getAssignment(familyId, id))) {
      return NextResponse.json({ error: 'Không tìm thấy bài tập.' }, { status: 404 });
    }
    if (body.status !== 'done' && body.status !== 'todo') {
      return NextResponse.json({ error: 'Trạng thái không hợp lệ.' }, { status: 400 });
    }
    return NextResponse.json({ assignment: await setStatus(familyId, id, body.status === 'done') });
  }

  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });
  if (!(await getAssignment(familyId, id))) {
    return NextResponse.json({ error: 'Không tìm thấy bài tập.' }, { status: 404 });
  }
  return NextResponse.json({ assignment: await updateAssignment(familyId, id, body) });
}

/** DELETE /api/assignments/:id — chi bo me, chi bai cua nha minh. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const { id } = await params;
  if (!(await getAssignment(familyId, id))) {
    return NextResponse.json({ error: 'Không tìm thấy bài tập.' }, { status: 404 });
  }
  await deleteAssignment(familyId, id);
  return NextResponse.json({ ok: true });
}
