import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { bookTrungTen, createBook, listBooks, locChildIdsGiaoCho } from '@/lib/store';
import { MAX_CHU_TEN_SACH, monSachOf } from '@/lib/types';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sach — sach / vo / nguon bai tap cua NHA NAY (issue #64). CAN PIN.
 *
 * Man cua con khong goi duong nay: ten sach da nam trong assignments.note tu luc
 * tach bai, con khong can bang sach.
 */
export async function GET() {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  return NextResponse.json({ books: await listBooks(familyId) });
}

/**
 * POST /api/sach { name, subject?, childIds? } — them mot cuon. CAN PIN.
 *
 *   name      ten sach, 1..MAX_CHU_TEN_SACH ky tu, khong trung cuon dang co
 *   subject   khoa mon trong SUBJECTS; thieu / la -> null (chua ro mon)
 *   childIds  null/thieu = ca nha; mang id con (khong rong, thuoc nha nay)
 */
export async function POST(req: Request) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (body?.name !== undefined && typeof body.name !== 'string') {
    return NextResponse.json({ error: T('Chưa nhập tên sách.') }, { status: 400 });
  }
  const name = (body?.name ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return NextResponse.json({ error: T('Chưa nhập tên sách.') }, { status: 400 });
  if (name.length > MAX_CHU_TEN_SACH) {
    return NextResponse.json({ error: T('Tên sách dài quá, để ngắn thôi.') }, { status: 400 });
  }
  if (await bookTrungTen(familyId, name)) {
    return NextResponse.json({ error: T('Nhà mình đã có cuốn này rồi.') }, { status: 400 });
  }

  const giaoCho = await locChildIdsGiaoCho(familyId, body?.childIds);
  if ('error' in giaoCho) return NextResponse.json({ error: T(giaoCho.error) }, { status: 400 });

  return NextResponse.json({
    book: await createBook(familyId, {
      name,
      subject: monSachOf(body?.subject),
      childIds: giaoCho.childIds,
    }),
  });
}
