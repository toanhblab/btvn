import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { viewingFamilyId } from '@/lib/auth';
import { getChild, listAssignments, todayISO } from '@/lib/store';
import type { Assignment, HwSource } from '@/lib/types';
import { HW_SOURCES } from '@/lib/types';

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
  const familyId = await viewingFamilyId();
  if (!familyId) redirect('/vao');

  // getChild loc theo nha: con cua nha khac coi nhu khong ton tai, du co dung
  // dung link. Cac con khong dang nhap nen day la lop chan duy nhat.
  const child = await getChild(familyId, childId);
  if (!child) notFound();

  const today = todayISO();
  const tomorrow = todayISO(1);

  // Tu hom nay tro di: bai qua han khong hien nua, khong thi danh sach cu dai mai
  const items = await listAssignments(familyId, { childId, from: today });
  const todayItems = items.filter((a) => a.dueDate === today);
  const done = todayItems.filter((a) => a.status === 'done').length;

  // Gom theo NOI GIAO truoc (lop tieng Anh / truong tieu hoc), trong moi noi
  // moi gom theo ngay. Con lam xong het bai mot noi roi moi sang noi kia, nen
  // moi noi can mot khoi rieng voi tien do rieng.
  const sourceGroups = (Object.keys(HW_SOURCES) as HwSource[])
    .map((source) => {
      const mine = items.filter((a) => a.source === source);
      // listAssignments da sap xep theo due_date tang dan nen chi can gom lien tiep
      const byDate: { date: string; items: Assignment[] }[] = [];
      for (const a of mine) {
        const last = byDate[byDate.length - 1];
        if (last && last.date === a.dueDate) last.items.push(a);
        else byDate.push({ date: a.dueDate, items: [a] });
      }
      return {
        source,
        byDate,
        total: mine.length,
        done: mine.filter((a) => a.status === 'done').length,
      };
    })
    .filter((g) => g.total > 0);

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

      {sourceGroups.map((sg) => (
        <section key={sg.source} className="mb-k-stack last:mb-0">
          {/* Dau moi nhom: noi giao + tien do RIENG cua nhom do, de con lam het
              mot loai bai (vd het bai lop tieng Anh) roi moi sang loai kia */}
          <div
            className={`flex items-center gap-4 rounded-2xl p-4 mb-4 soft-shadow ${
              sg.done === sg.total ? 'bg-success-container' : 'bg-surface-container-low'
            }`}
          >
            <span className="text-5xl shrink-0">{HW_SOURCES[sg.source].icon}</span>
            <h2 className="text-k-headline text-on-surface flex-1 min-w-0">
              {HW_SOURCES[sg.source].label}
            </h2>
            <span
              className={`text-k-label px-5 py-2 rounded-full shrink-0 ${
                sg.done === sg.total ? 'bg-success text-white' : 'bg-surface-container-highest text-on-surface'
              }`}
            >
              {sg.done === sg.total ? '🎉 ' : ''}{sg.done}/{sg.total} bài xong
            </span>
          </div>

          {sg.byDate.map((g) => (
            <div key={g.date} className="mb-6 last:mb-0">
              <h3 className="text-k-headline text-on-surface-variant mb-4">
                {nhanNgay(g.date, today, tomorrow)}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-k-gutter">
            {g.items.map((a) => {
              const isDone = a.status === 'done';
              // "video, ghi âm" chu khong chi dem so tep: con chua doc duoc so,
              // nhung bo me liec qua biet ngay bai nay co gi cho con
              const coGi = [
                a.media.some((m) => m.kind === 'video') && 'video',
                a.media.some((m) => m.kind === 'audio') && 'ghi âm',
                a.media.some((m) => m.kind === 'image') && 'ảnh',
              ].filter(Boolean).join(', ');
              return (
                <Link
                  key={a.id}
                  href={`/con/${child.id}/bai/${a.id}`}
                  className={`rounded-[32px] p-6 flex items-center justify-between min-h-[160px] relative overflow-hidden ${
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

                      {/* Ten sach / vo / so trang lay duoc luc bo me giao bai. Hien
                          ngay o day chu khong doi mo tung bai: con phai biet lay
                          dung quyen nao ra truoc khi ngoi vao ban. */}
                      {a.note && (
                        <div
                          className={`flex items-start gap-2 mt-1.5 min-w-0 ${
                            isDone ? 'text-on-success-container' : 'text-on-surface-variant'
                          }`}
                        >
                          <span className="material-symbols-outlined text-2xl shrink-0">menu_book</span>
                          {/* Cho xuong hai dong chu khong cat mot dong: ghi chu that
                              cua co giao thuong dai ("... chuong trinh Cambridge 1"),
                              cat mot dong la mat dung phan noi la sach nao */}
                          <span className="text-k-body-sm line-clamp-2">{a.note}</span>
                        </div>
                      )}

                      {/* Bai phai quay video nop: bao ngay tren the de con goi
                          bo me chuan bi may quay truoc khi mo bai */}
                      {a.requiresVideo && !isDone && (
                        <div className="flex items-center gap-2 mt-1.5 text-error">
                          <span className="material-symbols-outlined text-2xl icon-fill shrink-0">
                            videocam
                          </span>
                          <span className="text-k-body-sm font-bold">Bài này quay video</span>
                        </div>
                      )}

                      {/* Bao truoc cho con biet mo bai nay ra la co gi cua co gui kem */}
                      {coGi && (
                        <div
                          className={`flex items-center gap-2 mt-1.5 ${
                            isDone ? 'text-on-success-container' : 'text-tertiary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-2xl icon-fill shrink-0">
                            attach_file
                          </span>
                          <span className="text-k-body-sm font-bold">Có {coGi} cô gửi</span>
                        </div>
                      )}
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
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
