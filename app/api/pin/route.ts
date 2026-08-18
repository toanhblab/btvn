import { NextResponse } from 'next/server';
import { checkPin, isLocked, isParent, recordFail, recordSuccess, signIn, signOut } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET — kiem tra thiet bi nay da mo khoa chua (man PIN dung de tu chuyen huong). */
export async function GET() {
  return NextResponse.json({ unlocked: await isParent() });
}

/**
 * POST { pin, remember } — kiem tra PIN.
 * Gioi han so lan nhap sai theo IP (PRD muc 10) de con khong mo mo ra duoc.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const pin = String(body?.pin ?? '');
  const key = req.headers.get('x-forwarded-for') ?? 'local';

  const wait = isLocked(key);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Sai nhiều lần quá. Thử lại sau ${wait} giây.` },
      { status: 429 }
    );
  }

  if (!(await checkPin(pin))) {
    recordFail(key);
    return NextResponse.json({ error: 'Mã PIN không đúng.' }, { status: 401 });
  }

  recordSuccess(key);
  // remember mac dinh false — PRD 4.5: KHONG nho PIN tren iPad dung chung cua cac con.
  await signIn(body?.remember === true);
  return NextResponse.json({ ok: true });
}

/** DELETE — quen PIN tren thiet bi nay. */
export async function DELETE() {
  await signOut();
  return NextResponse.json({ ok: true });
}
