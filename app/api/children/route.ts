import { NextResponse } from 'next/server';
import { listChildren, progressUpcoming } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/children            -> danh sach con
 * GET /api/children?progress=1 -> kem so bai sap toi / da xong / qua han
 *
 * Khong can PIN: man chon con cua tre goi endpoint nay.
 */
export async function GET(req: Request) {
  const withProgress = new URL(req.url).searchParams.get('progress') === '1';
  if (withProgress) {
    return NextResponse.json({ children: await progressUpcoming() });
  }
  return NextResponse.json({ children: await listChildren() });
}
