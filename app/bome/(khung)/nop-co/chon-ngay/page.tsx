import Link from 'next/link';
import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { SO_NGAY_QUET_GAN_DAY, ngayGanNhatCoBai, ngayTiengViet } from '@/lib/ngay';
import { listAssignments, todayISO } from '@/lib/store';
import { HW_SOURCES } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SO_NUT = 3;

/**
 * "Chon ngay nop bai" (issue #31) — loi vao ON DINH cho man /bome/nop-co, thay
 * vi CHI hien khi HOM NAY co bai (nut o trang tong quan truoc day). Liet ke 3
 * NGAY GAN NHAT that su co bai lop tieng Anh, moi ngay mot nut mo dung man nop
 * bai (/bome/nop-co?ngay=...) da co san — xem lai / nop lai deu qua do.
 */
export default async function ChonNgayNopBai() {
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const homNay = todayISO();
  const items = await listAssignments(familyId, {
    source: 'english_class',
    from: todayISO(-SO_NGAY_QUET_GAN_DAY),
    to: homNay,
  });

  const gopTheoNgay = ngayGanNhatCoBai(items.map((a) => a.dueDate), homNay, SO_NUT).map((ngay) => {
    const cuaNgay = items.filter((a) => a.dueDate === ngay);
    const soVideo = cuaNgay.filter((a) => a.submittedVideoUrl).length;
    return { ngay, tong: cuaNgay.length, soVideo };
  });

  return (
    <main className="px-p-page pt-4 xl:max-w-lg xl:mx-auto">
      <header className="flex items-center gap-2 mb-5">
        <Link href="/bome" className="min-h-p-tap flex items-center text-on-surface-variant pr-1">
          <span className="material-symbols-outlined text-3xl">arrow_back</span>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-p-headline text-primary">Nộp bài cho cô</h1>
          <p className="text-p-body-sm text-on-surface-variant">
            Xem lại hoặc nộp lại video bài {HW_SOURCES.english_class.icon}{' '}
            {HW_SOURCES.english_class.label} những ngày gần đây
          </p>
        </div>
      </header>

      {gopTheoNgay.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-card card-shadow p-6 text-center xl:p-10">
          <p className="text-p-body text-on-surface mb-1">
            Chưa có bài nào của lớp {HW_SOURCES.english_class.label}.
          </p>
          <p className="text-p-body-sm text-on-surface-variant mb-4">
            Chỉ bài của lớp tiếng Anh mới phải nộp lại video cho cô.
          </p>
          <Link
            href="/bome"
            className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary
                       rounded-card min-h-p-tap px-6 h-12 text-p-body font-bold"
          >
            <span className="material-symbols-outlined">home</span>
            Về tổng quan
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-p-card">
          {gopTheoNgay.map(({ ngay, tong, soVideo }) => (
            <Link
              key={ngay}
              href={`/bome/nop-co?ngay=${ngay}`}
              className="bg-surface-container-lowest rounded-card card-shadow flex items-center gap-3
                         p-4 min-h-p-tap"
            >
              <span className="flex items-center justify-center w-11 h-11 rounded-full bg-tertiary-fixed shrink-0">
                <span className="material-symbols-outlined text-on-tertiary-fixed">send</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-p-body text-on-surface font-bold">
                  {ngayTiengViet(ngay)}
                  {ngay === homNay && ' · Hôm nay'}
                </span>
                <span className="block text-p-body-sm text-on-surface-variant">
                  {soVideo}/{tong} video đã quay
                </span>
              </span>
              <span className="material-symbols-outlined text-outline shrink-0">chevron_right</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
