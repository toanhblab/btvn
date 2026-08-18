import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getChild } from '@/lib/store';
import Confetti from './Confetti';

export const dynamic = 'force-dynamic';

/** Xong het bai hom nay — nen tu Stitch 04. */
export default async function Xong({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const child = await getChild(childId);
  if (!child) notFound();

  return (
    <main className="kid-scope min-h-screen flex flex-col items-center justify-center relative overflow-hidden text-center px-k-edge">
      <Confetti />

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
          className="w-56 h-56 object-cover rounded-full mb-6 animate-pulse-glow soft-shadow"
        />
        <h1 className="text-k-hero text-primary mb-4">Giỏi quá {child.name}!</h1>
        <p className="text-k-body text-on-surface-variant mb-8">
          Con làm hết bài hôm nay rồi. Đi chơi thôi!
        </p>
        <Link
          href="/con"
          className="flex items-center justify-center gap-4 bg-primary text-on-primary text-k-headline
                     h-20 px-12 rounded-[40px] border-b-8 border-on-primary-fixed-variant
                     active:border-b-0 active:translate-y-2 transition-all"
        >
          <span className="material-symbols-outlined text-[40px]">arrow_back</span>
          <span>Quay lại</span>
        </Link>
      </div>
    </main>
  );
}
