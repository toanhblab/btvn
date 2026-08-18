import { NextResponse } from 'next/server';
import { attachDeviceFamily } from '@/lib/auth';
import { getFamilyBySlug } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * GET /nha/<slug> — link bo me gui cho nhau de bay may cho cac con.
 *
 * Mo link mot lan la may nho luon nha do (cookie mot nam) roi vao thang man chon
 * con. Khong phai nhap gi ca: iPad cua tre khong dang nhap (PRD 4.5), va slug
 * ngau nhien nen nguoi ngoai khong doan ra (PRD muc 10).
 *
 * Day la route handler chu khong phai page vi chi route handler moi dat duoc
 * cookie — server component khong dat duoc trong luc render.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const family = await getFamilyBySlug(slug);

  // Link sai hoac nha da bi xoa -> ve man chon nha, khong bao loi ky thuat
  if (!family) return NextResponse.redirect(new URL('/vao?loi=link', req.url));

  const res = NextResponse.redirect(new URL('/con', req.url));
  await attachDeviceFamily(res, family.id);
  return res;
}
