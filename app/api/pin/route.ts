import { NextResponse } from 'next/server';
import { attemptPin, changePin, parentFamilyId, signIn, signOut } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET — kiem tra thiet bi nay da mo khoa chua (man PIN dung de tu chuyen huong). */
export async function GET() {
  return NextResponse.json({ unlocked: (await parentFamilyId()) !== null });
}

/**
 * POST { pin, remember } — nhap PIN de mo phan bo me.
 *
 * PIN vua la mat khau vua la danh tinh: no quyet dinh LA NHA NAO, khong chi
 * dung/sai. Gioi han so lan nhap sai theo IP (PRD muc 10).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const pin = String(body?.pin ?? '');
  const key = req.headers.get('x-forwarded-for') ?? 'local';

  const tried = await attemptPin(pin, key);
  if (!tried.ok) return NextResponse.json({ error: tried.error }, { status: tried.status });

  // remember mac dinh false — PRD 4.5: KHONG nho PIN tren iPad dung chung cua cac con.
  await signIn(tried.family.id, body?.remember === true);
  return NextResponse.json({ ok: true, family: tried.family });
}

/**
 * PATCH { oldPin, newPin } — doi ma PIN cua nha.
 *
 * Khong dang xuat cac thiet bi khac: cookie phien ky theo id cua nha chu khong
 * theo PIN. Muon dong phan bo me tren mot may thi vao Cai dat cua may do bam
 * "Quen PIN tren thiet bi nay".
 */
export async function PATCH(req: Request) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const result = await changePin(familyId, String(body?.oldPin ?? ''), String(body?.newPin ?? ''));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}

/** DELETE — quen PIN tren thiet bi nay (van giu "may nay la cua nha nao"). */
export async function DELETE() {
  await signOut();
  return NextResponse.json({ ok: true });
}
