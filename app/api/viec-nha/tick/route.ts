import { NextResponse } from 'next/server';
import { viewingFamilyId } from '@/lib/auth';
import { setChoreCheck, todayISO } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/viec-nha/tick { childId, choreId, done } — con tick / bo tick mot
 * viec nha CHO HOM NAY.
 *
 * Duong nay chay tren may cua con: chi co cookie thiet bi, KHONG co ma PIN —
 * giong het /api/nop-video. Nen phai tu kiem lay, khong tin gi tu trinh duyet:
 *
 *   1. viewingFamilyId() noi may nay thuoc nha nao. Chua gan nha -> 401.
 *   2. setChoreCheck kiem CA HAI phia trong mot cau SQL: viec phai thuoc nha do
 *      VA con phai thuoc nha do. Gui id cua nha khac thi tra 404, khong ghi gi.
 *   3. NGAY do may chu tu dat (todayISO), khong nhan tu body — nguoc lai thi con
 *      (hoac ai do) tick bu duoc cho ngay hom qua, bo me nhin so lieu thanh sai.
 *
 * Bo tick duoc vi tre bam nham la chuyen thuong (PRD 4.3, giong tick bai tap).
 */
export async function POST(req: Request) {
  const familyId = await viewingFamilyId();
  if (!familyId) {
    return NextResponse.json({ error: 'Máy này chưa gắn với nhà nào.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const childId = String(body?.childId ?? '');
  const choreId = String(body?.choreId ?? '');
  if (!childId || !choreId) {
    return NextResponse.json({ error: 'Thiếu thông tin.' }, { status: 400 });
  }

  const ok = await setChoreCheck(familyId, childId, choreId, todayISO(), body?.done === true);
  if (!ok) return NextResponse.json({ error: 'Không tìm thấy việc này.' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
