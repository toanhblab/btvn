import Link from 'next/link';
import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { countAssignments, listAssignments, listChildren, todayISO } from '@/lib/store';
import { HW_SOURCES } from '@/lib/types';
import XoaBai from '../con/[childId]/XoaBai';
import XoaTatCa from './XoaTatCa';

export const dynamic = 'force-dynamic';

/** Danh sach nhiem vu ca nha — nen tu stitch-parent 04. */
export default async function DanhSachNhiemVu() {
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const today = todayISO();
  const [children, items, total] = await Promise.all([
    listChildren(familyId),
    listAssignments(familyId, { from: todayISO(-7), to: todayISO(7) }),
    // Man nay chi liet ke 7 ngay quanh hom nay; nut xoa het phai noi dung tong
    // so bai trong DB chu khong phai so bai dang nhin thay.
    countAssignments(familyId),
  ]);

  const nameOf = new Map(children.map((c) => [c.id, c]));
  const done = items.filter((a) => a.status === 'done').length;

  const BAR: Record<string, string> = {
    primary: 'bg-primary',
    secondary: 'bg-secondary-container',
    tertiary: 'bg-tertiary-container',
  };

  // Qua han len dau, roi den hom nay, roi tuong lai
  const sorted = [...items].sort((a, b) => {
    const rank = (d: string) => (d < today ? 0 : d === today ? 1 : 2);
    return rank(a.dueDate) - rank(b.dueDate) || a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <main className="px-p-page pt-4">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-p-headline text-on-background">Danh sách bài tập</h1>
          <p className="text-p-body-sm text-on-surface-variant">Cả nhà · 7 ngày quanh hôm nay</p>
        </div>
        <span className="text-p-body-sm px-3 py-1.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed shrink-0">
          {done}/{items.length} xong
        </span>
      </header>

      <XoaTatCa total={total} />

      {sorted.length === 0 ? (
        <p className="text-p-body text-on-surface-variant text-center py-10">Chưa có bài tập nào.</p>
      ) : (
        <div className="flex flex-col gap-p-tight mb-4">
          {sorted.map((a) => {
            const child = nameOf.get(a.childId);
            const overdue = a.status === 'todo' && a.dueDate < today;
            return (
              <div
                key={a.id}
                className="bg-surface-container-lowest rounded-card card-shadow relative overflow-hidden
                           p-3 pl-4 flex items-start gap-2"
              >
                <div className={`absolute left-0 inset-y-0 w-1 ${BAR[child?.color ?? 'primary']}`} />
                <span
                  className={`material-symbols-outlined mt-0.5 shrink-0 ${
                    a.status === 'done' ? 'text-success icon-fill' : 'text-outline-variant'
                  }`}
                >
                  {a.status === 'done' ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-p-label uppercase text-on-surface-variant">
                      {a.icon} {a.subject}
                    </span>
                    <Link
                      href={`/bome/con/${a.childId}`}
                      className="text-p-label px-2 py-0.5 rounded-full bg-surface-container text-on-surface"
                    >
                      {child?.name ?? a.childId}
                    </Link>
                    {/* Noi giao — de bo me liec qua biet bai lop nao con chua xong */}
                    <span className="text-p-label px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
                      {HW_SOURCES[a.source].icon} {HW_SOURCES[a.source].label}
                    </span>
                  </div>
                  <p
                    className={`text-p-body ${
                      a.status === 'done' ? 'text-on-surface-variant line-through' : 'text-on-surface'
                    }`}
                  >
                    {a.content}
                  </p>
                  {/* Ten sach / trang lay duoc luc giao bai — bo me can nhin thay o
                      day de soan sach cho con ma khong phai mo tung bai */}
                  {a.note && (
                    <p className="flex items-start gap-1 text-p-body-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-base shrink-0">menu_book</span>
                      <span className="line-clamp-2">{a.note}</span>
                    </p>
                  )}
                  {a.media.length > 0 && (
                    <p className="flex items-center gap-1 text-p-body-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-base shrink-0">attach_file</span>
                      {a.media.length} tệp đính kèm
                    </p>
                  )}
                  <span
                    className={`text-p-body-sm ${overdue ? 'text-error font-bold' : 'text-on-surface-variant'}`}
                  >
                    {overdue
                      ? `Quá hạn — ${a.dueDate}`
                      : a.dueDate === today
                        ? 'Hôm nay'
                        : a.dueDate}
                  </span>
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
      )}

      <Link
        href="/bome/them"
        className="flex items-center justify-center gap-2 bg-primary text-on-primary rounded-card
                   h-14 min-h-p-tap text-p-body font-bold card-shadow"
      >
        <span className="material-symbols-outlined">add</span>
        Thêm bài tập mới
      </Link>
    </main>
  );
}
