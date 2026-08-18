import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getChild, listAssignments, todayISO } from '@/lib/store';
import type { Assignment } from '@/lib/types';

export const dynamic = 'force-dynamic';

const THU = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/**
 * "Hôm nay" / "Ngày mai" thay vì ngày tháng: tre 4 tuoi chua doc duoc lich,
 * cac ngay xa hon moi kem so de bo me liec biet la hom nao.
 */
function nhanNgay(date: string, today: string, tomorrow: string): string {
  if (date === today) return 'Hôm nay';
  if (date === tomorrow) return 'Ngày mai';
  const [y, m, d] = date.split('-').map(Number);
  return `${THU[new Date(y, m - 1, d).getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** Bai tap tu hom nay tro di cua mot con — nen tu Stitch 06, kem man trong tu Stitch 08. */
export default async function BaiHomNay({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const child = await getChild(childId);
  if (!child) notFound();

  const today = todayISO();
  const tomorrow = todayISO(1);

  // Tu hom nay tro di: bai qua han khong hien nua, khong thi danh sach cu dai mai
  const items = await listAssignments({ childId, from: today });
  const todayItems = items.filter((a) => a.dueDate === today);
  const done = todayItems.filter((a) => a.status === 'done').length;

  // listAssignments da sap xep theo due_date tang dan nen chi can gom lien tiep
  const groups: { date: string; items: Assignment[] }[] = [];
  for (const a of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === a.dueDate) last.items.push(a);
    else groups.push({ date: a.dueDate, items: [a] });
  }

  /* ---- Khong con bai nao sap toi: man khen thay vi man trong (PRD 4.3) ---- */
  if (items.length === 0) {
    return (
      <main className="kid-scope h-screen flex flex-col items-center justify-center text-center px-k-edge relative overflow-hidden">
        <div className="absolute top-[15%] left-[20%] w-16 h-8 bg-primary-fixed rounded-full opacity-60 animate-float-slow" />
        <div className="absolute top-[25%] right-[25%] w-12 h-12 bg-tertiary-fixed rounded-full opacity-70 animate-float-fast" />
        <div className="absolute bottom-[20%] left-[30%] w-20 h-10 bg-secondary-fixed rounded-full opacity-50 animate-float-slow" />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/be-vui-khong-co-bai.jpg"
          alt=""
          className="w-[240px] h-[240px] object-cover rounded-full soft-shadow mb-k-stack"
        />
        <h1 className="text-k-hero text-on-background mb-3">Hôm nay không có bài tập 🎉</h1>
        <p className="text-k-headline text-on-surface-variant mb-8">{child.name} đi chơi thôi!</p>

        <Link
          href="/con"
          className="h-k-tap min-w-[280px] rounded-3xl border-4 border-primary text-primary
                     flex items-center justify-center px-12 text-k-label hover:bg-primary-fixed transition-colors"
        >
          <span className="material-symbols-outlined mr-3">home</span>Về trang chính
        </Link>
      </main>
    );
  }

  return (
    <main className="kid-scope min-h-screen flex flex-col p-k-edge">
      <header className="flex items-center gap-6 mb-k-stack">
        <Link
          href="/con"
          className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center
                     interactive-shadow text-primary shrink-0"
        >
          <span className="material-symbols-outlined text-4xl icon-fill">arrow_back</span>
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={child.avatarUrl}
          alt=""
          className="w-16 h-16 rounded-full object-cover border-4 border-surface-container shrink-0"
        />
        <h1 className="text-k-hero text-primary">Bài tập của {child.name}</h1>
      </header>

      {/* Tien do chi tinh bai hom nay: do la thu con phai lam xong truoc khi di choi (PRD 4.3) */}
      {todayItems.length > 0 && (
        <section className="bg-surface-container-low rounded-2xl p-6 mb-k-stack flex items-center gap-k-gutter soft-shadow">
          <div className="flex gap-4 flex-wrap">
            {todayItems.map((a) => (
              <div
                key={a.id}
                className={
                  a.status === 'done'
                    ? 'w-16 h-16 rounded-xl bg-success flex items-center justify-center text-white'
                    : 'w-16 h-16 rounded-xl border-4 border-dashed border-outline-variant bg-surface'
                }
              >
                {a.status === 'done' && (
                  <span className="material-symbols-outlined text-4xl icon-fill">check</span>
                )}
              </div>
            ))}
          </div>
          <div className="text-k-headline text-on-surface">
            {done}/{todayItems.length} bài hôm nay đã xong
          </div>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.date} className="mb-k-stack last:mb-0">
          <h2 className="text-k-headline text-on-surface-variant mb-4">
            {nhanNgay(g.date, today, tomorrow)}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-k-gutter">
            {g.items.map((a) => {
              const isDone = a.status === 'done';
              return (
                <Link
                  key={a.id}
                  href={`/con/${child.id}/bai/${a.id}`}
                  className={`rounded-[32px] p-6 flex items-center justify-between h-[160px] relative overflow-hidden ${
                    isDone
                      ? 'bg-success-container opacity-80 soft-shadow'
                      : 'bg-surface border-[6px] border-primary interactive-shadow'
                  }`}
                >
                  {isDone && (
                    <div className="absolute top-4 left-4 w-12 h-12 bg-success rounded-full flex items-center justify-center text-white">
                      <span className="material-symbols-outlined text-3xl icon-fill">check</span>
                    </div>
                  )}
                  <div className={`flex items-center gap-6 min-w-0 ${isDone ? 'ml-12' : ''}`}>
                    <div className="text-6xl shrink-0">{a.icon}</div>
                    <div className="min-w-0">
                      <div
                        className={`text-k-body-sm uppercase tracking-wider font-bold mb-1 ${
                          isDone ? 'text-on-success-container' : 'text-primary'
                        }`}
                      >
                        {a.subject}
                      </div>
                      {/* text-k-body (24px) chu khong phai 32px: o 32px thi de bai bi cat
                          con vai chu, tre nhin vao khong doan ra bai gi. */}
                      <div
                        className={`text-k-body font-bold line-clamp-2 ${
                          isDone ? 'text-on-success-container' : 'text-on-surface'
                        }`}
                      >
                        {a.content}
                      </div>
                    </div>
                  </div>
                  {a.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.imageUrl}
                      alt=""
                      className={`w-24 h-24 rounded-2xl object-cover shrink-0 ml-4 border-4 ${
                        isDone ? 'border-white/50 opacity-70' : 'border-surface-container-highest'
                      }`}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
