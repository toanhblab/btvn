import { NextResponse } from 'next/server';
import { createFamily, parentFamilyId, signIn } from '@/lib/auth';
import { getFamilyById, updateFamilyName } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * POST { name, pin } — mot nha moi tu tao lay ho so cua minh.
 *
 * Khong can moi, khong can duyet: bo me chia se app cho ban be, nguoi ta mo web
 * len tu tao nha va tu chon ma PIN. Rang buoc duy nhat la PIN chua co nha khac
 * dung (xem lib/auth.ts).
 *
 * Tao xong dang nhap luon — vua tu dat PIN ma bat nhap lai ngay thi vo ich.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim() || 'Nhà mình';
  if (name.length > 40) {
    return NextResponse.json({ error: 'Tên nhà dài quá, để ngắn thôi.' }, { status: 400 });
  }

  const created = await createFamily(name, String(body?.pin ?? ''));
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 409 });

  await signIn(created.family.id, body?.remember === true);
  return NextResponse.json({ family: created.family });
}

/** PATCH { name } — doi ten nha. */
export async function PATCH(req: Request) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Tên nhà không được để trống.' }, { status: 400 });
  if (name.length > 40) {
    return NextResponse.json({ error: 'Tên nhà dài quá, để ngắn thôi.' }, { status: 400 });
  }

  await updateFamilyName(familyId, name);
  return NextResponse.json({ family: await getFamilyById(familyId) });
}
