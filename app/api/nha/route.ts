import { NextResponse } from 'next/server';
import { attemptPin, setDeviceFamily } from '@/lib/auth';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * POST { pin } — gan MAY NAY vao mot nha, cho man hinh cua con.
 *
 * Khac /api/pin: duong nay KHONG mo phan bo me. Dung khi lan dau bay iPad cho
 * cac con ma khong co san link /nha/<slug> — nhap PIN mot lan roi may nho luon
 * mot nam, cac con mo len la chay, khong dang nhap gi (PRD 4.5).
 *
 * Nho vay PIN cua bo me khong bi "nho" tren may cua tre.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const key = req.headers.get('x-forwarded-for') ?? 'local';

  const tried = await attemptPin(String(body?.pin ?? ''), key);
  if (!tried.ok) {
    const T = await chu();
    return NextResponse.json({ error: T(tried.error, tried.tham) }, { status: tried.status });
  }

  await setDeviceFamily(tried.family.id);
  return NextResponse.json({ ok: true, family: tried.family });
}
