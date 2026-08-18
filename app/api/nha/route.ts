import { NextResponse } from 'next/server';
import { attemptPin, setDeviceFamily } from '@/lib/auth';

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
  if (!tried.ok) return NextResponse.json({ error: tried.error }, { status: tried.status });

  await setDeviceFamily(tried.family.id);
  return NextResponse.json({ ok: true, family: tried.family });
}
