import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { getChild, listAssignments, todayISO } from '@/lib/store';
import XoaBai from './XoaBai';

export const dynamic = 'force-dynamic';

/** Chi tiet hoc tap cua mot con — nen tu stitch-parent 09. */
export default async function ChiTietCon({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ pham_vi?: string }>;
}) {
  const { childId } = await params;
  const { pham_vi } = await searchParams;
  const tuanNay = pham_vi === 'tuan';

  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const child = await getChild(familyId, childId);
  if (!child) notFound();

  const today = todayISO();
  const items = tuanNay
    ? await listAssignments(familyId, { childId, from: todayISO(-6), to: todayISO(6) })
    : await listAssignments(familyId, { childId, date: today });

  const done = items.filter((a) => a.status === 'done').length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  // Nhom theo mon cho de liec
  const groups = items.reduce<Record<string, typeof items>>((acc, a) => {
    (acc[a.subject] ??= []).push(a);
    return acc;
  }, {});

  return (
    <main className="px-p-page pt-4">
      <header className="flex items-center gap-2 mb-4">
        <Link href="/bome" className="min-h-p-tap flex items-center text-on-surface-variant pr-1">
          <span className="material-symbols-outlined text-3xl">arrow_back</span>
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={child.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
        <div className="flex-1 min-w-0">
          <h1 className="text-p-headline-md text-on-background">
            {child.name} — {child.grade}
          </h1>
          <Link href={`/con/${child.id}`} className="text-p-body-sm text-primary">
            Xem như con đang thấy →
          </Link>
        </div>
        <Link
          href={`/bome/con/${child.id}/sua`}
          className="min-h-p-tap flex items-center text-on-surface-variant shrink-0 px-1"
          aria-label={`Sửa hồ sơ của ${child.name}`}
        >
          <span className="material-symbols-outlined">edit</span>
        </Link>
      </header>

      <div className="flex gap-2 mb-4">
        {[
          ['Hôm nay', `/bome/con/${child.id}`, !tuanNay],
          ['Tuần này', `/bome/con/${child.id}?pham_vi=tuan`, tuanNay],
        ].map(([label, href, active]) => (
          <Link
            key={label as string}
            href={href as string}
            className={`px-5 min-h-p-tap flex items-center rounded-full text-p-body-sm font-bold border
                        ${active
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-lowest text-on-surface-variant border-surface-container-high'}`}
          >
            {label as string}
          </Link>
        ))}
      </div>

      <section className="mb-5">
        <div className="flex justify-between text-p-body-sm text-on-surface-variant mb-1.5">
          <span>Tiến độ {tuanNay ? 'tuần này' : 'hôm nay'}</span>
          <span>{done}/{items.length} bài đã xong</span>
        </div>
        <div className="h-2.5 rounded-full bg-surface-container-high overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </section>

      {items.length === 0 ? (
        <p className="text-p-body text-on-surface-variant text-center py-10">
          {tuanNay ? 'Tuần này chưa có bài nào.' : 'Hôm nay chưa giao bài nào cho ' + child.name + '.'}
        </p>
      ) : (
        Object.entries(groups).map(([subject, list]) => (
          <section key={subject} className="mb-4">
            <h2 className="text-p-label uppercase text-on-surface-variant mb-2">
              {list[0].icon} {subject}
            </h2>
            <div className="flex flex-col gap-p-tight">
              {list.map((a) => {
                const overdue = a.status === 'todo' && a.dueDate < today;
                return (
                  <div
                    key={a.id}
                    className="bg-surface-container-lowest rounded-card card-shadow p-3 flex items-start gap-2"
                  >
                    <span
                      className={`material-symbols-outlined mt-0.5 shrink-0 ${
                        a.status === 'done' ? 'text-success icon-fill' : 'text-outline-variant'
                      }`}
                    >
                      {a.status === 'done' ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-p-body ${
                          a.status === 'done' ? 'text-on-surface-variant line-through' : 'text-on-surface'
                        }`}
                      >
                        {a.content}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {/* Cung mot bieu tuong sach nhu o man cua con va danh sach
                            nhiem vu, de bo me nhan ra ngay day la sach/trang */}
                        {a.note && (
                          <span className="flex items-start gap-1 text-p-body-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-base shrink-0">menu_book</span>
                            {a.note}
                          </span>
                        )}
                        {a.lang === 'en' && (
                          <span className="text-p-label px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
                            🇬🇧 Giọng Anh
                          </span>
                        )}
                        {a.media.length > 0 && (
                          <span className="text-p-label px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
                            📎 {a.media.length} đính kèm
                          </span>
                        )}
                        {overdue && (
                          <span className="text-p-label px-2 py-0.5 rounded-full bg-error-container text-on-error-container">
                            Quá hạn {a.dueDate}
                          </span>
                        )}
                        {tuanNay && !overdue && (
                          <span className="text-p-label text-outline">{a.dueDate}</span>
                        )}
                      </div>
                    </div>
                    {/* Sua duoc sau khi giao: doi de bai, han, video… (/bome/bai/<id>) */}
                    <Link
                      href={`/bome/bai/${a.id}`}
                      className="text-outline hover:text-primary min-h-p-tap px-1 shrink-0 flex items-center"
                      aria-label="Sửa bài tập"
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </Link>
                    <XoaBai id={a.id} />
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <Link
        href="/bome/them"
        className="flex items-center justify-center gap-2 bg-primary text-on-primary rounded-card
                   h-14 min-h-p-tap text-p-body font-bold card-shadow mt-4"
      >
        <span className="material-symbols-outlined">add</span>
        Thêm bài tập cho {child.name}
      </Link>
    </main>
  );
}
