import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { viewingFamilyId } from '@/lib/auth';
import { getChild, listChoreChecks, listChores, todayISO } from '@/lib/store';
import Confetti from './Confetti';
import ViecNha from './ViecNha';

export const dynamic = 'force-dynamic';

/** Xong het bai hom nay — nen tu Stitch 04. */
export default async function Xong({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const familyId = await viewingFamilyId();
  if (!familyId) redirect('/vao');

  const child = await getChild(familyId, childId);
  if (!child) notFound();

  // Viec nha bo me dang bat + nhung viec con da tick HOM NAY. Nha nao khong bat
  // viec nao thi man nay giu nguyen y nhu truoc khi co tinh nang — khong tieu de
  // mo coi, khong khoi trong.
  const [chores, daTick] = await Promise.all([
    listChores(familyId, { enabledOnly: true }),
    listChoreChecks(familyId, childId, todayISO()),
  ]);
  const coViecNha = chores.length > 0;

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
        {/* Co danh sach viec nha thi cup nho lai: iPad ngang chi cao 820px, giu
            cup 224px thi ba dong viec va nut "Quay lai" bi day xuong duoi man —
            ma <main> dang overflow-hidden (cho confetti) nen phan tran ra la mat
            han, khong keo xuong xem duoc. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/cup-chuc-mung.jpg"
          alt=""
          className={`object-cover rounded-full mb-6 animate-pulse-glow soft-shadow
                      ${coViecNha ? 'w-40 h-40 xl:w-44 xl:h-44' : 'w-56 h-56 xl:w-60 xl:h-60'}`}
        />
        <h1 className="text-k-hero text-primary mb-4">Giỏi quá {child.name}!</h1>
        <p className="text-k-body text-on-surface-variant mb-8">
          Con làm hết bài hôm nay rồi. Đi chơi thôi!
        </p>

        {coViecNha && <ViecNha childId={childId} chores={chores} daTick={daTick} />}

        <Link
          href="/con"
          className="flex items-center justify-center gap-4 bg-primary text-on-primary text-k-headline
                     h-20 px-12 xl:min-w-[280px] rounded-[40px] border-b-8 border-on-primary-fixed-variant
                     active:border-b-0 active:translate-y-2 transition-all"
        >
          <span className="material-symbols-outlined text-[40px]">arrow_back</span>
          <span>Quay lại</span>
        </Link>
      </div>
    </main>
  );
}
