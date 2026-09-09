import { NextResponse } from 'next/server';
import { viewingFamilyId } from '@/lib/auth';
import { xinDoiThuong } from '@/lib/store';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/doi-thuong { childId, rewardId } — CON xin doi mot phan thuong.
 * KHONG can PIN: con khong dang nhap (PRD 4.5), xac thuc bang cookie thiet bi
 * nhu duong tick bai. Diem CHUA bi tru o buoc nay — bo me duyet
 * (PATCH /api/doi-thuong/:id) thi moi tru.
 *
 * childId phai thuoc nha cua may nay (xinDoiThuong kiem qua getChild), khong
 * thi may nha nay xin doi thuong bang diem cua con nha khac neu doan ra id.
 */
export async function POST(req: Request) {
  const T = await chu();
  const familyId = await viewingFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Máy này chưa gắn với nhà nào.') }, { status: 401 });

  const body = await req.json().catch(() => null);
  const childId = String(body?.childId ?? '');
  const rewardId = String(body?.rewardId ?? '');
  if (!childId || !rewardId) {
    return NextResponse.json({ error: T('Dữ liệu không đọc được.') }, { status: 400 });
  }

  const kq = await xinDoiThuong(familyId, childId, rewardId);
  if (!kq.ok) return NextResponse.json({ error: T(kq.error, kq.tham) }, { status: kq.status });
  return NextResponse.json({ redemption: kq.redemption });
}
