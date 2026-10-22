import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { doanQuayVideo, hasAI, MAX_DE_DOAN_VIDEO } from '@/lib/ai';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/doan-video  { deBai: string[] }  -> { canQuayVideo: boolean[] }
 *
 * AI doan tung de bai co bat con quay video khong (nut "Tach bai nay" o man
 * Kiem tra lai). Chua cai AI hay AI loi thi tra 503 — man Kiem tra lai giu
 * nguyen ket qua cua luoi tho, bo me van bat/tat chip 🎥 bang tay duoc.
 */
export async function POST(req: Request) {
  const T = await chu();
  if (!(await parentFamilyId())) {
    return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const deBai = Array.isArray(body?.deBai) ? body.deBai : null;
  if (!deBai || deBai.length === 0 || deBai.length > MAX_DE_DOAN_VIDEO ||
      !deBai.every((d: unknown) => typeof d === 'string' && d.trim() && d.length <= 2000)) {
    return NextResponse.json({ error: 'deBai' }, { status: 400 });
  }
  if (!hasAI) return NextResponse.json({ error: 'NO_API_KEY' }, { status: 503 });
  try {
    return NextResponse.json({ canQuayVideo: await doanQuayVideo(deBai) });
  } catch (err) {
    console.error('Khong doan duoc quay video', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 503 });
  }
}
