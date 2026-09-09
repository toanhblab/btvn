import type { Metadata, Viewport } from 'next';
import { NgonNguProvider } from '@/lib/i18n/client';
import { chu, ngonNguHienTai } from '@/lib/i18n/server';
import './globals.css';

/**
 * Tieu de tab theo ngon ngu cua nha dang mo. Metadata tinh (robots) giu o day
 * de khong phu thuoc DB.
 */
export async function generateMetadata(): Promise<Metadata> {
  const T = await chu();
  return {
    title: T('Bài tập về nhà'),
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
  return (
    <html lang={ngonNgu}>
      <head>
        {/* Dung link truc tiep thay vi next/font: next/font loi tren Node 26
            ("path argument must be a string, received URL"). */}
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
