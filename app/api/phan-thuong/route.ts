import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { createReward, listRewards } from '@/lib/store';
import { MAX_CHU_PHAN_THUONG, lamSachGia, lamSachIcon } from '@/lib/types';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/phan-thuong — danh sach phan thuong CUA NHA NAY (ca cai dang tat). CAN PIN.
 *
 * Man cua con khong goi duong nay: cua hang (app/con/[childId]/thuong) la server
 * component, doc thang listRewards(enabledOnly) voi nha cua cookie thiet bi.
 */
export async function GET() {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  return NextResponse.json({ rewards: await listRewards(familyId) });
}

/** POST /api/phan-thuong { name, icon, cost } — them mot phan thuong. CAN PIN. */
export async function POST(req: Request) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: T('Chưa đặt tên phần thưởng.') }, { status: 400 });
  if (name.length > MAX_CHU_PHAN_THUONG) {
    return NextResponse.json({ error: T('Tên dài quá, để ngắn thôi cho con đọc được.') }, { status: 400 });
  }
  const cost = lamSachGia(body?.cost);
  if (cost === null) return NextResponse.json({ error: T('Giá phải là một số điểm lớn hơn 0.') }, { status: 400 });

  return NextResponse.json({
    reward: await createReward(familyId, { name, icon: lamSachIcon(body?.icon), cost }),
  });
}
