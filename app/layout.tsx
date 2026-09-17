import type { Metadata, Viewport } from 'next';
import { NgonNguProvider } from '@/lib/i18n/client';
import { chu, ngonNguHienTai, nhaDangMo } from '@/lib/i18n/server';
import './globals.css';

/**
 * Tieu de tab theo ngon ngu cua nha dang mo. Metadata tinh (robots) giu o day
 * de khong phu thuoc DB.
 */
export async function generateMetadata(): Promise<Metadata> {
  const T = await chu();
  return {
    title: T('Bài tập về nhà'),
    // Cai thanh app tren man hinh chinh (issue #70). Ban ke khai o
    // app/api/manifest/route.ts (<link> ghep tay trong <head> duoi day); icon o
    // app/icon.png + app/apple-icon.png. iOS khong doc het ban ke khai nen can them
    // cac the rieng nay: mo roi khong co thanh dia chi, ten ngan duoi icon, thanh
    // trang thai mau nen.
    appleWebApp: { capable: true, title: T('Bài tập'), statusBarStyle: 'default' },
    // PRD muc 10: app chay tren internet cong khai va man cua con khong dang nhap
    // -> tuyet doi khong cho search engine index.
    robots: { index: false, follow: false, nocache: true },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  // Mau thanh trang thai khi mo o che do app roi — cung mau nen cua trang.
  themeColor: '#fff8f1',
};

/**
 * Phong cho chu Nhat / Han: Quicksand khong co glyph CJK nen trinh duyet se roi
 * ve phong he thong; nap them Noto Sans JP/KR cho hai nha demo de chu khong lech
 * dam nhat voi Quicksand. Chi nap khi can — nha tieng Viet khong tai them gi.
 */
const PHONG_THEM: Partial<Record<string, string>> = {
  ja: '&family=Noto+Sans+JP:wght@500;700',
  ko: '&family=Noto+Sans+KR:wght@500;700',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Ngon ngu la thuoc tinh CUA NHA (issue #46): doc tu cookie -> DB moi request.
  // Moi trang deu force-dynamic san nen khong mat gi them.
  const ngonNgu = await ngonNguHienTai();
  // Ma nha ghep vao dia chi ban ke khai de start_url cua app cai duoc la link gan
  // may cua dung nha nay — trinh duyet tai ban ke khai KHONG kem cookie (xem
  // app/api/manifest/route.ts). May chua gan nha thi ban ke khai chung, mo vao `/`.
  const slug = (await nhaDangMo())?.slug;
  return (
    <html lang={ngonNgu}>
      <head>
        <link rel="manifest" href={slug ? `/api/manifest?nha=${encodeURIComponent(slug)}` : '/api/manifest'} />
        {/* Dung link truc tiep thay vi next/font: next/font loi tren Node 26
            ("path argument must be a string, received URL"). */}
        {/* Next chi sinh `mobile-web-app-capable` (the moi) tu `appleWebApp.capable`;
            iOS truoc 17.4 chi doc the cu nay, nen ghi tay them de may cu cung mo
            duoc o che do app roi. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1${PHONG_THEM[ngonNgu] ?? ''}&display=swap`}
        />
      </head>
      <body>
        <NgonNguProvider ngonNgu={ngonNgu}>{children}</NgonNguProvider>
      </body>
    </html>
  );
}
