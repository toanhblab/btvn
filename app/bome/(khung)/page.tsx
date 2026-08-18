import Link from 'next/link';
import { progressUpcoming } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Bang dieu khien — nen tu stitch-parent 02. Ban Stitch chi co 2 con, PRD muc 11 co 3. */
export default async function BangDieuKhien() {
  const rows = await progressUpcoming();

  const totalDone = rows.reduce((s, r) => s + r.done, 0);
  const totalTodo = rows.reduce((s, r) => s + (r.total - r.done), 0);
  const totalOverdue = rows.reduce((s, r) => s + r.overdue, 0);

  const BAR: Record<string, string> = {
    primary: 'bg-primary',
    secondary: 'bg-secondary-container',
    tertiary: 'bg-tertiary-container',
  };

  return (
    <main className="px-p-page pt-4">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-p-headline text-on-background">Tổng quan</h1>
        <Link
          href="/con"
          className="flex items-center gap-1.5 text-p-body-sm text-primary min-h-p-tap px-3
                     rounded-full bg-primary-fixed"
        >
          <span className="material-symbols-outlined text-xl">tablet_android</span>
          Màn hình của con
        </Link>
      </header>

      {/* Ba o tinh trang chung — dem bai tu hom nay tro di, ghi ro de khoi doc nham la rieng hom nay */}
      <p className="text-p-body-sm text-on-surface-variant mb-2">Bài từ hôm nay trở đi</p>
      <section className="grid grid-cols-3 gap-p-card mb-6">
        {[
          { n: totalDone, label: 'Hoàn thành', color: 'text-primary', ring: 'border-primary/30' },
          { n: totalTodo, label: 'Đang chờ', color: 'text-tertiary', ring: 'border-tertiary/30' },
          { n: totalOverdue, label: 'Quá hạn', color: 'text-error', ring: 'border-error/30' },
        ].map((o) => (
          <div
            key={o.label}
            className={`bg-surface-container-lowest rounded-card border ${o.ring} p-3 text-center card-shadow`}
          >
            <div className={`text-p-headline ${o.color}`}>{o.n}</div>
            <div className="text-p-body-sm text-on-surface-variant">{o.label}</div>
          </div>
        ))}
      </section>

      <h2 className="text-p-headline-md text-on-background mb-3">Các con</h2>
      <div className="flex flex-col gap-p-tight mb-6">
        {rows.map(({ child, total, done, overdue }) => (
          <Link
            key={child.id}
            href={`/bome/con/${child.id}`}
            className="bg-surface-container-lowest rounded-card card-shadow flex items-center gap-3 p-3
                       relative overflow-hidden min-h-p-tap"
          >
            {/* Thanh mau doc ben trai bao con nao — theo design system muc "Task Cards" */}
            <div className={`absolute left-0 inset-y-0 w-1 ${BAR[child.color]}`} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={child.avatarUrl}
              alt=""
              className="w-11 h-11 rounded-full object-cover ml-1.5 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-p-body text-on-surface font-bold">{child.name}</div>
              <div className="text-p-body-sm text-on-surface-variant">{child.grade}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 text-p-body-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-base text-success icon-fill">check_circle</span>
                {done}/{total}
              </span>
              {overdue > 0 && (
                <span className="inline-flex items-center gap-1 text-p-body-sm text-error">
                  <span className="material-symbols-outlined text-base">warning</span>
                  {overdue}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      <Link
        href="/bome/them"
        className="flex items-center justify-center gap-2 bg-primary text-on-primary rounded-card
                   min-h-p-tap h-14 text-p-body font-bold card-shadow"
      >
        <span className="material-symbols-outlined">add</span>
        Thêm bài tập
      </Link>
    </main>
  );
}
