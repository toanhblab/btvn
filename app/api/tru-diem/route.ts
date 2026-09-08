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
 * POST /api/tru-diem { childId, points | truHet: true, reason? } — BO ME tru ⭐
 * cua con (issue #43). CAN PIN. Chi tru, khong co duong cong tay.
 *
 *   points   so ⭐ bo me GO (nguyen duong) — lich su luu dung so nay.
 *   truHet   thay cho points: tru DUNG so du tai luc may chu chay cau — la nut
 *            "Tru het N" hien sau khi bi tu choi; N khong gui len, may chu tu tinh.
 *   reason   khong bat buoc, cat theo MAX_CHU_LY_DO_TRU; con se doc dong nay.
 *
 * So du KHONG BAO GIO am: go qua so con dang co -> 400 kem `conLai` de man bo me
 * moi "Tru het N". Kiem va ghi trong mot transaction co khoa theo con (truDiem).
 */
export async function POST(req: Request) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const childId = String(body?.childId ?? '');
  if (!childId) return NextResponse.json({ error: 'Dữ liệu không đọc được.' }, { status: 400 });

  let points: number | null = null;
  if (body?.truHet !== true) {
    points = lamSachDiemTru(body?.points);
    if (points === null) {
      return NextResponse.json({ error: 'Số ⭐ trừ phải là một số lớn hơn 0.' }, { status: 400 });
    }
  }

  const kq = await truDiem(familyId, childId, points, lamSachLyDoTru(body?.reason));
  if (!kq.ok) return NextResponse.json({ error: kq.error, conLai: kq.conLai }, { status: kq.status });
  return NextResponse.json({ penalty: kq.penalty, conLai: kq.conLai });
}
