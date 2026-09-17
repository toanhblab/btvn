import { NextResponse } from 'next/server';
import type { MetadataRoute } from 'next';
import { getFamilyBySlug } from '@/lib/store';
import { taoT } from '@/lib/i18n/chu';
import { NGON_NGU_MAC_DINH } from '@/lib/i18n/ngonNgu';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manifest?nha=<slug> — ban ke khai de "Them vao man hinh chinh" (issue
 * #70): con cham mot cai la vao thang bai tap, khong mo trinh duyet roi go dia chi.
 *
 * KHONG CO service worker, co y: iOS/Android/Chrome deu cai duoc chi voi ban ke
 * khai nay + icon, con service worker da cai len may con thi song dai, phuc vu
 * ban cu sau khi deploy, va con khong tu go duoc. App can mang de lam gi cung
 * duoc (bai, video, diem deu o may chu) nen "chay offline" khong phai muc tieu.
 *
 * `start_url` la link gan may `/nha/<slug>` cua nha dang mo, khong phai `/`:
 * app da cai tren iOS co KHO COOKIE RIENG, khong dung chung voi Safari, nen neu
 * mo `/` thi lan dau app se khong biet may nay cua nha nao va bat nhap PIN lai.
 * Link `/nha/<slug>` gan may vao dung nha roi chuyen sang /con — chinh la duong
 * gan may san co (app/nha/[slug]/route.ts), khong them duong nao moi.
 *
 * Vi sao slug di qua QUERY chu khong doc cookie: trinh duyet tai ban ke khai
 * voi credentials "omit" (da do tren Chrome: cookie nha KHONG di kem), nen route
 * nay khong biet may dang mo nha nao. app/layout.tsx — noi co cookie — ghep slug
 * vao href cua <link rel="manifest">. Slug da nam san trong cookie cua chinh may
 * do va hien o man Cai dat, nen ghi vao HTML khong lo them gi. `id` co dinh de
 * trinh duyet coi day la MOT app du href/start_url doi theo nha.
 *
 * Day la route handler thay cho app/manifest.ts vi ham manifest() cua Next khong
 * nhan request (khong doc duoc query), va <link> Next tu sinh khong them duoc
 * crossorigin="use-credentials".
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('nha') ?? '';
  const family = /^[a-z0-9-]{1,64}$/i.test(slug) ? await getFamilyBySlug(slug).catch(() => null) : null;
  // Chu tren man hinh chinh theo ngon ngu CUA NHA (issue #46); chua ro nha thi tieng Viet.
  const T = taoT(family?.ngonNgu ?? NGON_NGU_MAC_DINH);

  const manifest: MetadataRoute.Manifest = {
    id: '/',
    name: T('Bài tập về nhà'),
    short_name: T('Bài tập'),
    description: T('Bài tập và nhiệm vụ hàng ngày của các con'),
    start_url: family ? `/nha/${family.slug}` : '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#fff8f1',
    theme_color: '#fff8f1',
    lang: family?.ngonNgu ?? NGON_NGU_MAC_DINH,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return NextResponse.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
