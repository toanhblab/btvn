import { NextResponse, type NextRequest } from 'next/server';

/**
 * Chan toan bo /bome/* neu chua mo khoa bang PIN.
 *
 * Next 16 doi ten quy uoc "middleware" thanh "proxy".
 *
 * Chi kiem tra cookie CO MAT hay khong — day la lop chan tho cho dieu huong.
 * Viec doi chieu gia tri that nam o lib/auth.ts va duoc goi lai trong tung
 * route handler, vi lop nay chay o Edge nen khong dung duoc DB.
 */
export default function proxy(req: NextRequest) {
  const hasCookie = Boolean(req.cookies.get('btvn_parent')?.value);
  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/bome/pin';
    url.search = `?tiep=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Chan tat ca /bome/* tru chinh man nhap PIN
  matcher: ['/bome', '/bome/((?!pin).*)'],
};
