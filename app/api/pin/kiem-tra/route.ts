import { NextResponse } from 'next/server';
import { attemptPin, recordFail, viewingFamilyId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST { pin } — CHI kiem tra ma PIN co dung cua nha nay khong, khong mo phien
 * bo me.
 *
 * Tach khoi POST /api/pin vi duong nay chay tren MAY CUA CON: nut "Bố mẹ đặt
 * lại giờ" o man chi tiet bai. Neu dung /api/pin thi bo me vua go PIN xong la
 * may cua con co cookie btvn_parent va con mo thang duoc /bome — dung dieu PRD
 * 4.5 cam. O day chi tra ok/khong, khong dat cookie nao.
 *
 * Chot them theo NHA: PIN cua nha khac dung cung khong dat lai duoc gio bai cua
 * nha nay. Van di qua attemptPin nen dung chung han muc nhap sai theo IP voi hai
 * duong nhap PIN kia (lib/auth) — them mot duong khong gioi han la coi nhu bo
 * gioi han.
 */
export async function POST(req: Request) {
  const familyId = await viewingFamilyId();
  if (!familyId) {
    return NextResponse.json({ error: 'Máy này chưa gắn với nhà nào.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const key = req.headers.get('x-forwarded-for') ?? 'local';

  const tried = await attemptPin(String(body?.pin ?? ''), key);
  if (!tried.ok) return NextResponse.json({ error: tried.error }, { status: tried.status });

  if (tried.family.id !== familyId) {
    // attemptPin da xoa bo dem vi PIN nay co that — ghi lai mot lan sai, khong
    // thi go lan luot PIN cua cac nha khac khong bao gio bi khoa.
    recordFail(key);
    return NextResponse.json({ error: 'Mã PIN không đúng.' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
