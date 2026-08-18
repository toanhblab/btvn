import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { deleteChild, getChild, updateChild } from '@/lib/store';
import type { ChildColor } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const COLORS: ChildColor[] = ['primary', 'secondary', 'tertiary'];

/**
 * PATCH /api/children/:id
 *   { name?, avatarUrl?, color?, grade? } -> bo me sua ho so mot con, CAN PIN.
 *
 * Con chi duoc xem chu khong duoc sua ho so cua minh (PRD 4.5) nen o day khong
 * co duong nao bo qua PIN, khac voi PATCH bai tap (tre tu tick xong duoc).
 *
 * getChild loc theo nha nen con cua nha khac tra ve 404 — nha nay khong sua duoc
 * ho so con nha khac du co biet id.
 *
 * Cot name/avatar_url la NOT NULL va color co CHECK trong schema. Kiem o day de
 * bo me nhan duoc loi tieng Viet doc hieu duoc thay vi loi Postgres 500.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dữ liệu không đọc được.' }, { status: 400 });

  if (!(await getChild(familyId, id))) {
    return NextResponse.json({ error: 'Không tìm thấy con này.' }, { status: 404 });
  }

  const patch: Parameters<typeof updateChild>[2] = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'Tên không được để trống.' }, { status: 400 });
    if (name.length > 40) {
      return NextResponse.json({ error: 'Tên dài quá, để ngắn thôi cho vừa màn hình.' }, { status: 400 });
    }
    patch.name = name;
  }

  if (body.avatarUrl !== undefined) {
    const url = String(body.avatarUrl).trim();
    if (!url) return NextResponse.json({ error: 'Phải có ảnh của con.' }, { status: 400 });
    patch.avatarUrl = url;
  }

  if (body.color !== undefined) {
    if (!COLORS.includes(body.color)) {
      return NextResponse.json({ error: 'Màu không hợp lệ.' }, { status: 400 });
    }
    patch.color = body.color;
  }

  // Lop de trong duoc — cot grade cho phep NULL.
  if (body.grade !== undefined) {
    const grade = String(body.grade ?? '').trim();
    patch.grade = grade || null;
  }

  return NextResponse.json({ child: await updateChild(familyId, id, patch) });
}

/**
 * DELETE /api/children/:id — xoa mot con. CAN PIN.
 *
 * Bai tap cua con do di theo (ON DELETE CASCADE) nen giao dien phai hoi lai va
 * noi ro so bai se mat.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const { id } = await params;
  if (!(await getChild(familyId, id))) {
    return NextResponse.json({ error: 'Không tìm thấy con này.' }, { status: 404 });
  }

  await deleteChild(familyId, id);
  return NextResponse.json({ ok: true });
}
