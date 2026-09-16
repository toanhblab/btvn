import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { bookTrungTen, deleteBook, getBook, locChildIdsGiaoCho, updateBook } from '@/lib/store';
import { MAX_CHU_TEN_SACH, monSachOf } from '@/lib/types';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/sach/:id — sua mot cuon sach. CAN PIN.
 *
 *   { name }       doi ten (khong trung cuon khac dang co)
 *   { subject }    khoa mon trong SUBJECTS, hoac null = chua ro
 *   { childIds }   null = ca nha; mang id con (khong rong, thuoc nha nay)
 *
 * getBook loc theo nha va loai cuon da bo nen sach cua nha khac / da bo tra 404.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: T('Dữ liệu không đọc được.') }, { status: 400 });
  }

  if (!(await getBook(familyId, id))) {
    return NextResponse.json({ error: T('Không tìm thấy cuốn sách này.') }, { status: 404 });
  }

  const patch: Parameters<typeof updateBook>[2] = {};

  if (body.name !== undefined) {
    const name = String(body.name).replace(/\s+/g, ' ').trim();
    if (!name) return NextResponse.json({ error: T('Chưa nhập tên sách.') }, { status: 400 });
    if (name.length > MAX_CHU_TEN_SACH) {
      return NextResponse.json({ error: T('Tên sách dài quá, để ngắn thôi.') }, { status: 400 });
    }
    if (await bookTrungTen(familyId, name, id)) {
      return NextResponse.json({ error: T('Nhà mình đã có cuốn này rồi.') }, { status: 400 });
    }
    patch.name = name;
  }
  if ('subject' in body) patch.subject = monSachOf(body.subject);
  if ('childIds' in body) {
    const giaoCho = await locChildIdsGiaoCho(familyId, body.childIds);
    if ('error' in giaoCho) return NextResponse.json({ error: T(giaoCho.error) }, { status: 400 });
    patch.childIds = giaoCho.childIds;
  }

  return NextResponse.json({ book: await updateBook(familyId, id, patch) });
}

/**
 * DELETE /api/sach/:id — BO mot cuon sach. CAN PIN.
 *
 * Danh dau da bo chu khong xoa dong that (deleteBook, migrations/021): cuon sach
 * bien khoi danh sach va khoi loi nhac AI tu lan tach sau; bai da giao giu nguyen
 * ten sach trong ghi chu. Khong co nut khoi phuc nen giao dien hoi lai truoc khi goi.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const { id } = await params;
  if (!(await getBook(familyId, id))) {
    return NextResponse.json({ error: T('Không tìm thấy cuốn sách này.') }, { status: 404 });
  }

  await deleteBook(familyId, id);
  return NextResponse.json({ ok: true });
}
