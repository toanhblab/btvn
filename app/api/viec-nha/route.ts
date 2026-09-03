import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { createChore, listChores } from '@/lib/store';
import { MAX_CHU_VIEC_NHA } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/viec-nha — danh sach viec nha CUA NHA NAY (ca viec dang tat). CAN PIN.
 *
 * Man cua con khong goi duong nay: no doc thang tu server component (trang
 * /con/<id>/xong) nen khong can mot duong doc khong PIN o day.
 */
export async function GET() {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  return NextResponse.json({ chores: await listChores(familyId) });
}

/** POST /api/viec-nha { content } — them mot viec vao cuoi danh sach. CAN PIN. */
export async function POST(req: Request) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const content = String(body?.content ?? '').trim();
  if (!content) return NextResponse.json({ error: 'Chưa nhập việc gì.' }, { status: 400 });
  if (content.length > MAX_CHU_VIEC_NHA) {
    return NextResponse.json({ error: 'Việc dài quá, để ngắn thôi cho con đọc được.' }, { status: 400 });
  }

  return NextResponse.json({ chore: await createChore(familyId, content) });
}
