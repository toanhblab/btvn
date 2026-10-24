import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { thuongDiem } from '@/lib/store';
import { lamSachDiemTru, lamSachLyDoTru } from '@/lib/types';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/thuong-diem { childId, points, reason? } — BO ME thuong ⭐ cho con
 * (migrations/023). CAN PIN. Chieu nguoc cua /api/tru-diem, cung cach lam sach
 * so (nguyen duong, kep tran) va ly do (con se doc dong nay o so ⭐).
 */
export async function POST(req: Request) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const body = await req.json().catch(() => null);
  const childId = String(body?.childId ?? '');
  if (!childId) return NextResponse.json({ error: T('Dữ liệu không đọc được.') }, { status: 400 });

  const points = lamSachDiemTru(body?.points);
  if (points === null) {
    return NextResponse.json({ error: T('Số ⭐ thưởng phải là một số lớn hơn 0.') }, { status: 400 });
  }

  const kq = await thuongDiem(familyId, childId, points, lamSachLyDoTru(body?.reason));
  if (!kq.ok) return NextResponse.json({ error: T(kq.error), conLai: kq.conLai }, { status: kq.status });
  return NextResponse.json({ bonus: kq.bonus, conLai: kq.conLai });
}
