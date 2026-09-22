import Link from 'next/link';
import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { listBooks, listChildren } from '@/lib/store';
import Sach from './Sach';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * Man "Sach cua cac con" cua bo me (issue #64) — trang rieng, vao tu the trong
 * Cai dat va tu dong dan tren man Them bai tap. Cung khuon voi
 * /bome/nhiem-vu-hang-ngay (khong co ban Stitch): the/nut/khoang cach cua bo bo
 * me, p-*, rounded-card, card-shadow.
 *
 * Chua co ban thiet ke Macbook nen tu 1280px giu cot hep (xl:max-w-lg) nhu cac
 * man bo me khac chua co ban Macbook — xem AGENTS.md.
 */
export default async function Page() {
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const [children, books] = await Promise.all([listChildren(familyId), listBooks(familyId)]);
  const T = await chu();

  return (
    <main className="px-p-page pt-4 xl:max-w-lg xl:mx-auto">
      <header className="flex items-center gap-2 mb-1">
        <Link href="/bome/cai-dat" className="min-h-p-tap flex items-center text-on-surface-variant pr-1" aria-label={T('Về Cài đặt')}>
          <span className="material-symbols-outlined text-3xl">arrow_back</span>
        </Link>
        <h1 className="text-p-headline text-on-background">{T('Sách của các con')}</h1>
      </header>
      <p className="text-p-body-sm text-on-surface-variant mb-5">
        {T('Khai tên sách, vở, phiếu bài tập các con đang dùng. Khi bố mẹ chụp tin nhắn của cô, máy dùng danh sách này để nhận đúng tên sách (kể cả khi cô viết tắt), đoán đúng môn, và gộp mọi trang / số bài trong cùng một cuốn thành MỘT bài. Chưa khai cuốn nào thì máy vẫn gộp theo sách dựa vào chữ trong tin nhắn.')}
      </p>

      <Sach initial={books} cacCon={children} />
    </main>
  );
}
