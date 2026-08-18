import { NextResponse, type NextRequest } from 'next/server';

/**
 * Chan toan bo /bome/* neu chua mo khoa bang PIN.
 *
 * Next 16 doi ten quy uoc "middleware" thanh "proxy".
 *
 * Chi kiem tra cookie CO MAT hay khong — day la lop chan tho cho dieu huong.
 * Viec doi chieu chu ky va xac dinh LA NHA NAO nam o lib/auth.ts va duoc goi lai
 * trong tung route handler / page, vi lop nay chay o Edge nen khong dung duoc DB.
 *
 * Cookie gia mao khong di duoc xa hon day: no qua duoc buoc nay nhung parentFamilyId()
 * se khong go duoc chu ky nen moi trang /bome deu day ve man nhap PIN.
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
  // Chan tat ca /bome/* tru man nhap PIN va man tao nha moi — nha chua ton tai
  // thi lam gi co PIN ma nhap.
  matcher: ['/bome', '/bome/((?!pin|tao-nha).*)'],
};
