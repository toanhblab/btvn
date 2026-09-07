import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { deleteReward, getReward, updateReward } from '@/lib/store';
import { MAX_CHU_PHAN_THUONG, lamSachGia, lamSachIcon } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/phan-thuong/:id — sua mot phan thuong. CAN PIN.
 *
 *   { name }     doi ten
 *   { icon }     doi icon (mot emoji)
 *   { cost }     doi gia diem
 *   { enabled }  bat / tat (tat thi con khong thay o cua hang nua)
 *
 * getReward loc theo nha nen phan thuong cua nha khac tra 404. Sua gia KHONG
 * doi cac yeu cau dang cho — chung da chep gia luc con xin.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dữ liệu không đọc được.' }, { status: 400 });

  if (!(await getReward(familyId, id))) {
    return NextResponse.json({ error: 'Không tìm thấy phần thưởng này.' }, { status: 404 });
  }

  const patch: Parameters<typeof updateReward>[2] = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'Chưa đặt tên phần thưởng.' }, { status: 400 });
    if (name.length > MAX_CHU_PHAN_THUONG) {
      return NextResponse.json({ error: 'Tên dài quá, để ngắn thôi cho con đọc được.' }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.icon !== undefined) patch.icon = lamSachIcon(body.icon);
  if (body.cost !== undefined) {
    const cost = lamSachGia(body.cost);
    if (cost === null) return NextResponse.json({ error: 'Giá phải là một số điểm lớn hơn 0.' }, { status: 400 });
    patch.cost = cost;
  }
  if (body.enabled !== undefined) patch.enabled = body.enabled === true;

  return NextResponse.json({ reward: await updateReward(familyId, id, patch) });
}

/**
 * DELETE /api/phan-thuong/:id — xoa han. CAN PIN. Yeu cau dang cho va lich su
 * doi cua phan thuong nay van con (da chep ten/gia), chi con khong thay no o
 * cua hang nua.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const { id } = await params;
  if (!(await getReward(familyId, id))) {
    return NextResponse.json({ error: 'Không tìm thấy phần thưởng này.' }, { status: 404 });
  }

  await deleteReward(familyId, id);
  return NextResponse.json({ ok: true });
}
