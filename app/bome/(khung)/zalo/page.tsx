import Link from 'next/link';
import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { listChildren } from '@/lib/store';
import { listBaiChoDuyet, listNguonZalo } from '@/lib/nhanBaiZalo';
import { chu } from '@/lib/i18n/server';
import ChoDuyet from './ChoDuyet';
import NguonZalo from './NguonZalo';

export const dynamic = 'force-dynamic';

/**
 * "Bài từ Zalo" — hai muc theo dung hop dong da chot voi captain:
 *   1. "Bài cô vừa giao, chờ duyệt": nguyen van tin cua co + tep kem + cac bai
 *      da tach, duyet MOT CHAM hoac bo.
 *   2. "Nhóm Zalo": khai bao / sua / tat tung nguon.
 *
 * Man moi, chua co ban Stitch — dung dung khuon man "Nhiệm vụ hàng ngày"
 * (the/nut/khoang cach cua bo bo me, token p-*, rounded-card, card-shadow), va
 * cung ly do do giu cot hep tu 1280px (`xl:max-w-lg`) nhu moi man bo me chua co
 * ban Macbook — xem AGENTS.md. Rieng muc cho duyet thi cho phep rong hon
 * (`xl:max-w-3xl`): no dat NGUYEN VAN tin canh danh sach bai da tach, ma ep ca
 * hai vao mot cot 32rem tren man Macbook la bo me phai cuon len xuong de doi
 * chieu — dung viec ma man nay sinh ra de lam.
 */
export default async function Page() {
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const [cacCon, nguon, choDuyet] = await Promise.all([
    listChildren(familyId),
    listNguonZalo(familyId),
    listBaiChoDuyet(familyId),
  ]);
  const T = await chu();

  return (
    <main className="px-p-page pt-4 xl:max-w-3xl xl:mx-auto">
      <header className="flex items-center gap-2 mb-1">
        <Link
          href="/bome"
          className="min-h-p-tap flex items-center text-on-surface-variant pr-1"
          aria-label={T('Về Trang chủ')}
        >
          <span className="material-symbols-outlined text-3xl">arrow_back</span>
        </Link>
        <h1 className="text-p-headline text-on-background">{T('Bài từ Zalo')}</h1>
      </header>
      <p className="text-p-body-sm text-on-surface-variant mb-5">
        {T('Cô đăng bài lên nhóm Zalo của lớp thì bài tự vào đây, kèm nguyên văn tin cô gửi. Bố mẹ đọc, sửa nếu cần, rồi bấm Duyệt — lúc đó các con mới thấy bài trên máy của mình.')}
      </p>

      <h2 className="text-p-headline-md text-on-background mb-3">{T('Bài cô vừa giao, chờ duyệt')}</h2>
      <ChoDuyet initial={choDuyet} cacCon={cacCon} />

      <h2 className="text-p-headline-md text-on-background mt-8 mb-1">{T('Nhóm Zalo')}</h2>
      <p className="text-p-body-sm text-on-surface-variant mb-3">
        {T('Mỗi nhóm là một lớp. Máy ở nhà đọc đúng những nhóm khai ở đây, nên thêm lớp mới thì chỉ cần gõ vào đây, không phải cài lại gì.')}
      </p>
      <NguonZalo initial={nguon} cacCon={cacCon} />
    </main>
  );
}
