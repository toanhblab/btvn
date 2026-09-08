import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { duyetDoiThuong } from '@/lib/store';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/doi-thuong/:id { decision: 'approve' | 'reject' } — BO ME duyet
 * hay tu choi mot yeu cau doi thuong. CAN PIN.
 *
 * Duyet thi diem bi tru ngay (so du doc tu status = 'approved'); tu choi thi
 * con giu nguyen diem va xin lai duoc cai khac. Yeu cau da xu ly roi thi 409 —
 * bo me bam hai lan khong duyet duoc hai lan.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (body?.decision !== 'approve' && body?.decision !== 'reject') {
    return NextResponse.json({ error: T('Quyết định không hợp lệ.') }, { status: 400 });
  }

  const kq = await duyetDoiThuong(familyId, id, body.decision === 'approve');
  if (!kq.ok) return NextResponse.json({ error: T(kq.error, kq.tham) }, { status: kq.status });
  return NextResponse.json({ redemption: kq.redemption });
}
