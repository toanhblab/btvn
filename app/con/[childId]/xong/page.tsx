import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { viewingFamilyId } from '@/lib/auth';
import { DIEM_NGAY_XONG } from '@/lib/diem';
import { daCongDiemNgay, getChild, listAssignments, soDiem, todayISO } from '@/lib/store';
import Confetti from './Confetti';

export const dynamic = 'force-dynamic';

/**
 * Xong het bai hom nay — nen tu Stitch 04.
 *
 * Truoc issue #36, man nay con hien mot checklist "Việc nhỏ trước khi đi chơi"
 * (ViecNha.tsx, da xoa) de con tick viec nha SAU KHI da xong bai. Viec nha gio
 * la mot dong assignments THAT, xep cuoi danh sach bai hom nay o
 * app/con/[childId]/page.tsx va tinh vao stillTodo o bai/[id]/page.tsx — nen
 * con CHI toi duoc man nay SAU KHI da tick het CA viec nha, khong con gi de
 * tick nua luc man nay hien ra. Checklist do vi vay tro thanh du thua (luon
 * hien "100% da xong"), da go bo; man nay tro ve thuan ăn mung nhu truoc #25.
 */
export default async function Xong({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const familyId = await viewingFamilyId();
  if (!familyId) redirect('/vao');

  // Con chi toi man nay khi vua xong bai CUOI cua HOM NAY, nen ngay duoc cong
  // 10 diem (neu co) chinh la hom nay. Doc lai tu DB thay vi tin may con: mo lai
  // man nay ngay hom sau thi khong bao 10 diem cua ngay nua ma van hien tong.
  //
  // homNay: de cau khen noi dung thu con vua lam xong (issue #42 Q2): ngay khong
  // co bai tap ma chi co nhiem vu thi khong duoc noi "lam het bai".
  const today = todayISO();
  const [child, diem, coDiemNgay, homNay] = await Promise.all([
    getChild(familyId, childId),
    soDiem(familyId, childId),
    daCongDiemNgay(familyId, childId, today),
    listAssignments(familyId, { childId, date: today, includeChores: true }),
  ]);
  if (!child) notFound();
  const coBai = homNay.some((a) => a.choreId === null);
  const coNhiemVu = homNay.some((a) => a.choreId !== null);
  const vuaXong = coBai && coNhiemVu ? 'hết bài và nhiệm vụ' : coNhiemVu ? 'hết nhiệm vụ' : 'hết bài';

  return (
    <main className="kid-scope min-h-screen flex flex-col items-center justify-center relative overflow-hidden text-center px-k-edge">
      <Confetti />

      {/* Bo Macbook 05 muon hai ngoi sao nay to hon o man rong, nhung text-[64px]
          hien tai da khong an: bang mau Material Symbols cua Google ship
          `.material-symbols-outlined { font-size: 24px }` KHONG nam trong @layer,
          nen no de moi lop text-* cua Tailwind (o @layer utilities) — moi icon
          trong app dang bi ghim 24px. Loi co truoc thay doi nay va anh huong ca
          man bo me, nen khong sua o day; them xl:text-[...] cung chi la CSS chet. */}
      <span className="material-symbols-outlined absolute top-[15%] left-[15%] text-[64px] text-tertiary-fixed-dim animate-float-slow">
        kid_star
      </span>
      <span className="material-symbols-outlined absolute bottom-[20%] right-[12%] text-[56px] text-secondary-fixed-dim animate-float-fast">
        stars
      </span>

      <div className="relative z-10 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/cup-chuc-mung.jpg"
          alt=""
          className="w-56 h-56 xl:w-60 xl:h-60 object-cover rounded-full mb-6 animate-pulse-glow soft-shadow"
        />
        <h1 className="text-k-hero text-primary mb-4">Giỏi quá {child.name}!</h1>
        <p className="text-k-body text-on-surface-variant mb-6">
          Con làm {vuaXong} hôm nay rồi. Đi chơi thôi!
        </p>

        {/* Diem cua ngay chi hien khi HOM NAY da co dong day_complete (ngay truoc
            score_since hay mo lai man nay hom sau thi khong). Cau chu khang dinh
            SU THAT CUA HOM NAY, khong noi "vua cong": con quay lai man nay lan
            nua trong ngay, hay bo me them bai roi con lam tiep, thi 10 diem do
            khong duoc cong lai (unique index) nhung van dung la diem cua hom nay.
            Tong thi luon hien. */}
        <div className="flex flex-col items-center gap-3 mb-8">
          {coDiemNgay && (
            <span className="text-k-headline bg-primary-fixed text-on-primary-fixed px-8 py-3 rounded-full soft-shadow">
              🏆 Hôm nay con được {DIEM_NGAY_XONG} điểm!
            </span>
          )}
          <span className="text-k-headline bg-tertiary-fixed text-on-tertiary-fixed px-8 py-3 rounded-full soft-shadow">
            Con đang có {diem} ⭐
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6">
          <Link
            href="/con"
            className="flex items-center justify-center gap-4 bg-primary text-on-primary text-k-headline
                       h-20 px-12 xl:min-w-[280px] rounded-[40px] border-b-8 border-on-primary-fixed-variant
                       active:border-b-0 active:translate-y-2 transition-all"
          >
            <span className="material-symbols-outlined text-[40px]">arrow_back</span>
            <span>Quay lại</span>
          </Link>
          <Link
            href={`/con/${childId}/thuong`}
            className="flex items-center justify-center gap-4 bg-tertiary-fixed-dim text-on-tertiary-fixed text-k-headline
                       h-20 px-12 xl:min-w-[280px] rounded-[40px] border-b-8 border-tertiary
                       active:border-b-0 active:translate-y-2 transition-all"
          >
            <span className="text-[40px] leading-none">🎁</span>
            <span>Đổi thưởng</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
