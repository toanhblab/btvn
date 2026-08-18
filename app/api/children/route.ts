import { NextResponse } from 'next/server';
import { parentFamilyId, viewingFamilyId } from '@/lib/auth';
import { createChild, listChildren, progressUpcoming } from '@/lib/store';
import type { ChildColor } from '@/lib/types';

export const dynamic = 'force-dynamic';

const COLORS: ChildColor[] = ['primary', 'secondary', 'tertiary'];

/**
 * GET /api/children            -> danh sach con CUA NHA NAY
 * GET /api/children?progress=1 -> kem so bai sap toi / da xong / qua han
 *
 * Khong can PIN: man chon con cua tre goi endpoint nay. Nhung phai biet la nha
 * nao — lay tu cookie thiet bi (may da duoc bay cho nha do) hoac tu phien bo me.
 */
export async function GET(req: Request) {
  const familyId = await viewingFamilyId();
  if (!familyId) {
    return NextResponse.json({ error: 'Máy này chưa gắn với nhà nào.' }, { status: 401 });
  }

  const withProgress = new URL(req.url).searchParams.get('progress') === '1';
  if (withProgress) {
    return NextResponse.json({ children: await progressUpcoming(familyId) });
  }
  return NextResponse.json({ children: await listChildren(familyId) });
}

/**
 * POST /api/children { name, avatarUrl, color, grade? } — them mot con. CAN PIN.
 *
 * Nha moi tao chua co con nao nen day la buoc dau tien cua bo me.
 */
export async function POST(req: Request) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dữ liệu không đọc được.' }, { status: 400 });

  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Tên không được để trống.' }, { status: 400 });
  if (name.length > 40) {
    return NextResponse.json({ error: 'Tên dài quá, để ngắn thôi cho vừa màn hình.' }, { status: 400 });
  }

  // Anh la thu tre dung de tu nhan ra minh (PRD muc 3) nen cot avatar_url la NOT NULL
  const avatarUrl = String(body.avatarUrl ?? '').trim();
  if (!avatarUrl) return NextResponse.json({ error: 'Phải có ảnh của con.' }, { status: 400 });

  const color: ChildColor = COLORS.includes(body.color) ? body.color : 'primary';
  const grade = String(body.grade ?? '').trim() || null;

  const child = await createChild(familyId, { name, avatarUrl, color, grade });
  return NextResponse.json({ child });
}
