import Link from 'next/link';
import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { lechNgay, ngayTiengViet } from '@/lib/ngay';
import { listAssignments, listChildren, todayISO } from '@/lib/store';
import { HW_SOURCES } from '@/lib/types';
import ChiaSeVideo, { type NhomNop } from './ChiaSeVideo';

export const dynamic = 'force-dynamic';

const NGAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "Bé Na" -> "BeNa". Ten tep gui cho co nen bo dau: Zalo va may cua co doi khi
    lam hong ten tep co dau, con so o cuoi thi luon doc duoc. */
function khongDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]/g, '');
}

/** An-TiengAnh-2026-09-02.mp4 — co nhin ten tep la biet con nao, bai gi, ngay nao. */
function tenTepNop(tenCon: string, mon: string, ngay: string, url: string): string {
  const duoi = /\.[a-z0-9]{1,5}$/i.exec(url.split('?')[0])?.[0] ?? '.mp4';
  return `${khongDau(tenCon)}-${khongDau(mon)}-${ngay}${duoi}`;
}

const BAR: Record<string, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary-container',
  tertiary: 'bg-tertiary-container',
};

/**
 * "Nộp bài cho cô" — video cac con da quay cho bai cua LOP TIENG ANH, theo ngay.
 *
 * Chi lop tieng Anh moi phai nop lai bai cho co, nen man nay loc theo MA nguon
 * `english_class` (HW_SOURCES), khong loc theo ten mon: ten mon la chu bo me go
 * tay, sua duoc bat cu luc nao.
 *
 * Man nay CHUA co ban thiet ke Stitch — bam theo kieu cua /bome/nhiem-vu (cot hep
 * duoi 1280px, khung 1080px tu 1280px) de khong lac khoi bo hien co.
 */
export default async function NopBaiChoCo({
  searchParams,
}: {
  searchParams: Promise<{ ngay?: string }>;
}) {
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const { ngay } = await searchParams;
  const homNay = todayISO();
  // Ngay di qua dia chi trang de bo me tai lai / gui link cho nhau van dung ngay.
  // Gia tri la thi lui ve hom nay chu khong bao loi — day khong phai o nhap lieu.
  const dangXem = ngay && NGAY_RE.test(ngay) ? ngay : homNay;

  const [children, items] = await Promise.all([
    listChildren(familyId),
    listAssignments(familyId, { date: dangXem, source: 'english_class' }),
  ]);

  // Nhom theo con, giu dung thu tu cac con nhu moi man khac cua bo me
  const nhom: NhomNop[] = children
    .map((c) => ({
      childId: c.id,
      tenCon: c.name,
      thanhMau: BAR[c.color] ?? BAR.primary,
      mucs: items
        .filter((a) => a.childId === c.id)
        .map((a) => ({
          id: a.id,
          icon: a.icon,
          mon: a.subject,
          noiDung: a.content,
          videoUrl: a.submittedVideoUrl,
          tenTep: a.submittedVideoUrl
            ? tenTepNop(c.name, a.subject, a.dueDate, a.submittedVideoUrl)
            : null,
        })),
    }))
    .filter((n) => n.mucs.length > 0);

  const soVideo = items.filter((a) => a.submittedVideoUrl).length;
  const nhan = ngayTiengViet(dangXem);

  return (
    <main className="px-p-page pt-4 xl:max-w-[1080px] xl:mx-auto xl:px-12 xl:py-12">
      <header className="flex items-center gap-2 mb-4 xl:mb-8">
        <Link href="/bome" className="min-h-p-tap flex items-center text-on-surface-variant pr-1">
          <span className="material-symbols-outlined text-3xl">arrow_back</span>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-p-headline text-on-background">Nộp bài cho cô</h1>
          <p className="text-p-body-sm text-on-surface-variant">
            Video bài {HW_SOURCES.english_class.icon} {HW_SOURCES.english_class.label} — bố mẹ tự gửi
            vào Zalo cho cô
          </p>
        </div>
      </header>

      {/* Chon ngay: lui / tien mot ngay. Khong dung lich day du — captain chi can
          "theo ngay", va bai lop tieng Anh thi bo me xem quanh hom nay la chinh. */}
      <nav className="flex items-center gap-2 mb-4 xl:mb-8" aria-label="Chọn ngày">
        <Link
          href={`/bome/nop-co?ngay=${lechNgay(dangXem, -1)}`}
          aria-label="Ngày trước"
          className="flex items-center justify-center w-12 h-12 min-h-p-tap rounded-full
                     bg-surface-container-lowest card-shadow text-on-surface-variant"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </Link>
        <div className="flex-1 text-center">
          <p className="text-p-headline-md text-on-surface">{nhan}</p>
          <p className="text-p-body-sm text-on-surface-variant">
            {dangXem === homNay ? 'Hôm nay' : dangXem}
          </p>
        </div>
        <Link
          href={`/bome/nop-co?ngay=${lechNgay(dangXem, 1)}`}
          aria-label="Ngày sau"
          className="flex items-center justify-center w-12 h-12 min-h-p-tap rounded-full
                     bg-surface-container-lowest card-shadow text-on-surface-variant"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </Link>
      </nav>

      <div className="flex items-center justify-center gap-4 mb-4">
        {dangXem !== homNay && (
          <Link href="/bome/nop-co" className="text-p-body-sm font-bold text-primary">
            Về hôm nay
          </Link>
        )}
        {/* Loi thoat khac ngoai lui/tien tung ngay: nhay thang toi 3 ngay gan
            nhat CO bai (issue #31) — bo me sang ngay moi khong con thay nut o
            trang tong quan van tim lai duoc bai cu qua day. */}
        <Link href="/bome/nop-co/chon-ngay" className="text-p-body-sm font-bold text-primary">
          Chọn ngày gần đây
        </Link>
      </div>

      {nhom.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-card card-shadow p-6 text-center xl:p-10">
          <p className="text-p-body text-on-surface mb-1">
            {nhan} không có bài nào của lớp {HW_SOURCES.english_class.label}.
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
        <>
          <p className="text-p-body-sm text-on-surface-variant mb-3">
            {soVideo}/{items.length} video đã quay
          </p>
          <ChiaSeVideo nhom={nhom} ngayVN={nhan} />
        </>
      )}
    </main>
  );
}
