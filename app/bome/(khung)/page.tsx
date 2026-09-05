import Link from 'next/link';
import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { SO_NGAY_QUET_GAN_DAY, ngayGanNhatCoBai } from '@/lib/ngay';
import { getFamilyById, listAssignments, progressUpcoming, todayISO } from '@/lib/store';
import { HW_SOURCES } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Bang dieu khien — nen tu stitch-parent 02 (dien thoai) va
 * stitch-parent-macbook 02 (Macbook). Ban Stitch chi co 2 con, PRD muc 11 co 3.
 */
export default async function BangDieuKhien() {
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const today = todayISO();
  const [family, rows, homNay, ganDay] = await Promise.all([
    getFamilyById(familyId),
    progressUpcoming(familyId),
    // Dung hai cho: danh sach "Bai hom nay" (chi co o co Macbook) va nut
    // "Nop bai cho co" ngay duoi ba o tinh trang (ca hai co man).
    listAssignments(familyId, { date: today }),
    // Rieng cho nut "Nop bai cho co": issue #31 — truoc day nut nay CHI hien
    // khi HOM NAY co bai lop tieng Anh nen sang ngay moi khong giao bai la bo
    // me mat luon loi vao, du bai hom truoc con chua nop. Gio xet ca N ngay gan
    // day, dan sang man /bome/nop-co/chon-ngay de bo me tu chon lai ngay.
    listAssignments(familyId, {
      source: 'english_class',
      from: todayISO(-SO_NGAY_QUET_GAN_DAY),
      to: today,
    }),
  ]);

  const baiTiengAnh = homNay.filter((a) => a.source === 'english_class');
  const videoDaQuay = baiTiengAnh.filter((a) => a.submittedVideoUrl).length;
  const coBaiGanDay = ngayGanNhatCoBai(ganDay.map((a) => a.dueDate), today, 1).length > 0;

  const totalDone = rows.reduce((s, r) => s + r.done, 0);
  const totalTodo = rows.reduce((s, r) => s + (r.total - r.done), 0);
  const totalOverdue = rows.reduce((s, r) => s + r.overdue, 0);

  const BAR: Record<string, string> = {
    primary: 'bg-primary',
    secondary: 'bg-secondary-container',
    tertiary: 'bg-tertiary-container',
  };

  const nameOf = new Map(rows.map((r) => [r.child.id, r.child]));

  return (
    <main className="px-p-page pt-4 xl:max-w-[1080px] xl:mx-auto xl:px-12 xl:py-12">
      <header className="flex items-center justify-between mb-5 xl:items-end xl:mb-8">
        <div className="min-w-0">
          {/* Ten nha: dam bao bo me biet dang mo dung nha minh, nhat la khi da
              tung nhap PIN nha khac tren may nay. O co Macbook no len tren tieu
              de lam dong dan huong, dung nhu ban thiet ke. */}
          <p className="hidden xl:block text-p-label uppercase tracking-wider text-on-surface-variant mb-1">
            {family?.name}
          </p>
          <h1 className="text-p-headline text-on-background">Tổng quan</h1>
          <p className="text-p-body-sm text-on-surface-variant truncate xl:hidden">{family?.name}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/con"
            className="flex items-center gap-1.5 text-p-body-sm text-primary min-h-p-tap px-3
                       rounded-full bg-primary-fixed xl:px-6"
          >
            <span className="material-symbols-outlined text-xl">tablet_android</span>
            Màn hình của con
          </Link>
          {/* Tren Macbook nut chinh nam o goc tren; ban dien thoai van giu nut
              rong ca hang o cuoi trang (o duoi) vi ngon cai voi toi day de hon */}
          {rows.length > 0 && (
            <Link
              href="/bome/them"
              className="hidden xl:flex items-center gap-1.5 text-p-body-sm font-bold text-on-primary
                         min-h-p-tap px-6 rounded-full bg-primary card-shadow"
            >
              <span className="material-symbols-outlined text-xl">add</span>
              Thêm bài tập
            </Link>
          )}
        </div>
      </header>

      {/* Ba o tinh trang chung — dem bai tu hom nay tro di, ghi ro de khoi doc nham la rieng hom nay */}
      <div className="flex items-center gap-4 mb-2 xl:mb-4">
        <span className="hidden xl:block h-px flex-1 bg-outline-variant/40" />
        <p className="text-p-body-sm text-on-surface-variant xl:text-p-label">Bài từ hôm nay trở đi</p>
        <span className="hidden xl:block h-px flex-1 bg-outline-variant/40" />
      </div>
      <section className="grid grid-cols-3 gap-p-card mb-6 xl:gap-6 xl:mb-10">
        {[
          { n: totalDone, label: 'Hoàn thành', color: 'text-primary', ring: 'border-primary/30' },
          { n: totalTodo, label: 'Đang chờ', color: 'text-tertiary', ring: 'border-tertiary/30' },
          { n: totalOverdue, label: 'Quá hạn', color: 'text-error', ring: 'border-error/30' },
        ].map((o) => (
          <div
            key={o.label}
            className={`bg-surface-container-lowest rounded-card border ${o.ring} p-3 text-center card-shadow
                        xl:py-10`}
          >
            <div className={`text-p-headline ${o.color} xl:text-5xl xl:mb-2`}>{o.n}</div>
            <div className="text-p-body-sm text-on-surface-variant">{o.label}</div>
          </div>
        ))}
      </section>

      {/* Nop bai cho co — chi lop tieng Anh moi phai nop lai video cho co. Nut
          nay la LOI VAO ON DINH (issue #31): hom nay co bai thi dan thang vao
          man cua hom nay, khong thi dan sang man "Chon ngay" de bo me tu tim
          lai 3 ngay gan nhat con chua nop / muon nop lai. */}
      {coBaiGanDay && (
        <Link
          href={baiTiengAnh.length > 0 ? '/bome/nop-co' : '/bome/nop-co/chon-ngay'}
          className="bg-surface-container-lowest rounded-card card-shadow flex items-center gap-3
                     p-3 mb-6 min-h-p-tap xl:p-6 xl:mb-10"
        >
          <span className="flex items-center justify-center w-11 h-11 rounded-full bg-tertiary-fixed
                           shrink-0 xl:w-14 xl:h-14">
            <span className="material-symbols-outlined text-on-tertiary-fixed">send</span>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-p-body text-on-surface font-bold">Nộp bài cho cô</span>
            <span className="block text-p-body-sm text-on-surface-variant">
              {baiTiengAnh.length > 0
                ? `${videoDaQuay}/${baiTiengAnh.length} video đã quay · `
                : 'Xem lại những ngày gần đây · '}
              {HW_SOURCES.english_class.icon} {HW_SOURCES.english_class.label}
            </span>
          </span>
          <span className="material-symbols-outlined text-outline shrink-0">chevron_right</span>
        </Link>
      )}

      <h2 className="text-p-headline-md text-on-background mb-3 xl:mb-4">Các con</h2>

      {/* Nha moi tao chua co con nao: nhap bai luc nay se khong giao duoc cho ai,
          nen day han bo me sang buoc them con truoc */}
      {rows.length === 0 && (
        <div className="bg-primary-fixed rounded-card p-3 mb-6 xl:p-6 xl:max-w-lg">
          <p className="text-p-body text-on-primary-fixed font-bold mb-0.5">Chưa có con nào</p>
          <p className="text-p-body-sm text-on-primary-fixed mb-3">
            Thêm hồ sơ cho các con trước, rồi mới nhập được bài tập.
          </p>
          <Link
            href="/bome/them-con"
            className="flex items-center justify-center gap-2 bg-primary text-on-primary rounded-card
                       min-h-p-tap h-12 text-p-body font-bold"
          >
            <span className="material-symbols-outlined">person_add</span>
            Thêm con
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-p-tight mb-6 xl:grid xl:grid-cols-3 xl:gap-6 xl:mb-10">
        {rows.map(({ child, total, done, overdue }) => (
          <Link
            key={child.id}
            href={`/bome/con/${child.id}`}
            className="bg-surface-container-lowest rounded-card card-shadow flex items-center gap-3 p-3
                       relative overflow-hidden min-h-p-tap
                       xl:flex-col xl:items-stretch xl:gap-5 xl:p-6 xl:pl-7"
          >
            {/* Thanh mau doc ben trai bao con nao — theo design system muc "Task Cards" */}
            <div className={`absolute left-0 inset-y-0 w-1 ${BAR[child.color]}`} />
            <span className="flex items-center gap-3 flex-1 min-w-0 xl:flex-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={child.avatarUrl}
                alt=""
                className="w-11 h-11 rounded-full object-cover ml-1.5 shrink-0 xl:w-16 xl:h-16 xl:ml-0"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-p-body text-on-surface font-bold">{child.name}</span>
                <span className="block text-p-body-sm text-on-surface-variant">{child.grade}</span>
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0 xl:flex-col xl:items-stretch xl:gap-2 xl:w-full">
              <span className="flex items-center gap-2 xl:w-full xl:justify-between">
                <span className="hidden xl:inline text-p-label text-on-surface-variant">Tiến độ</span>
                <span className="flex items-center gap-2">
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
                </span>
              </span>
              {/* Thanh tien do chi co trong ban Macbook — the tren dien thoai qua
                  hep, them vao chi lam dong "3/5" bi day xuong */}
              <span className="hidden xl:block h-2 rounded-full bg-surface-container overflow-hidden">
                <span
                  className={`block h-2 rounded-full ${BAR[child.color]}`}
                  style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }}
                />
              </span>
            </span>
          </Link>
        ))}
      </div>

      {/* ---- Bai hom nay: CHI co o co Macbook ----
          Ban thiet ke 02 bo trong hon nua man hinh duoi phan "Cac con". Cho do
          dat danh sach bai cua hom nay — dung thu bo me mo may tinh len de xem,
          va khong phai bam them mot buoc sang man Nhiem vu. Tren dien thoai
          khong hien: cuon them mot doan dai nua thi phan "Cac con" bi day mat. */}
      {rows.length > 0 && (
        <section className="hidden xl:block">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-p-headline-md text-on-background">Bài hôm nay</h2>
            <Link href="/bome/nhiem-vu" className="text-p-body-sm font-bold text-primary">
              Xem cả danh sách
            </Link>
          </div>

          {homNay.length === 0 ? (
            <p className="bg-surface-container-lowest rounded-card card-shadow p-6 text-p-body
                          text-on-surface-variant text-center">
              Hôm nay chưa có bài nào.
            </p>
          ) : (
            <div className="flex flex-col gap-p-tight">
              {homNay.map((a) => {
                const child = nameOf.get(a.childId);
                return (
                  <Link
                    key={a.id}
                    href={`/bome/bai/${a.id}`}
                    className="bg-surface-container-lowest rounded-card card-shadow relative overflow-hidden
                               flex items-center gap-3 p-4 pl-6"
                  >
                    <span className={`absolute left-0 inset-y-0 w-1 ${BAR[child?.color ?? 'primary']}`} />
                    <span
                      className={`material-symbols-outlined shrink-0 ${
                        a.status === 'done' ? 'text-success icon-fill' : 'text-outline-variant'
                      }`}
                    >
                      {a.status === 'done' ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span className="text-p-label uppercase text-on-surface-variant shrink-0 w-28 truncate">
                      {a.icon} {a.subject}
                    </span>
                    <span className="text-p-label px-2 py-0.5 rounded-full bg-surface-container
                                     text-on-surface shrink-0">
                      {child?.name ?? a.childId}
                    </span>
                    <span
                      className={`flex-1 min-w-0 truncate text-p-body ${
                        a.status === 'done' ? 'text-on-surface-variant line-through' : 'text-on-surface'
                      }`}
                    >
                      {a.content}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <Link
          href="/bome/them"
          className="flex items-center justify-center gap-2 bg-primary text-on-primary rounded-card
                     min-h-p-tap h-14 text-p-body font-bold card-shadow xl:hidden"
        >
          <span className="material-symbols-outlined">add</span>
          Thêm bài tập
        </Link>
      )}
    </main>
  );
}
