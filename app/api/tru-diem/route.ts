import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { listPenalties, truDiem } from '@/lib/store';
import { lamSachDiemTru, lamSachLyDoTru } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** GET /api/tru-diem?childId= — nhung lan da tru cua nha nay, moi nhat truoc. CAN PIN. */
export async function GET(req: Request) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const childId = new URL(req.url).searchParams.get('childId') ?? undefined;
  return NextResponse.json({ penalties: await listPenalties(familyId, { childId }) });
}

/**
 * POST /api/tru-diem { childId, points, reason? } — BO ME tru ⭐ cua con
 * (issue #43). CAN PIN. Chi tru, khong co duong cong tay.
 *
 *   points   con so TREN NHAN cua nut bo me vua bam (nguyen duong) — MOT duong
 *            duy nhat, ke ca khi nut doc "Tru het N": man hinh gui dung so no in
 *            ra. Day la TRAN TREN cua lan tru: may chu ghi LEAST(points, so du
 *            that luc chay cau), nen so tren man da cu khong lam con mat nhieu
 *            hon so tren nhan.
 *   reason   khong bat buoc, cat theo MAX_CHU_LY_DO_TRU; con se doc dong nay.
 *
 * So du KHONG BAO GIO am; ly do tu choi DUY NHAT la con khong con ⭐ nao -> 400
 * kem `conLai` de man bo me sua lai vien ⭐ ngay (man khong tu khoa nut theo so
 * do — day la cho DUY NHAT tu choi). Kiem va ghi trong mot transaction co khoa
 * theo con (truDiem).
 */
export async function POST(req: Request) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const childId = String(body?.childId ?? '');
  if (!childId) return NextResponse.json({ error: 'Dữ liệu không đọc được.' }, { status: 400 });

  const points = lamSachDiemTru(body?.points);
  if (points === null) {
    return NextResponse.json({ error: 'Số ⭐ trừ phải là một số lớn hơn 0.' }, { status: 400 });
  }

  const kq = await truDiem(familyId, childId, points, lamSachLyDoTru(body?.reason));
  if (!kq.ok) return NextResponse.json({ error: kq.error, conLai: kq.conLai }, { status: kq.status });
  return NextResponse.json({ penalty: kq.penalty, conLai: kq.conLai });
}
