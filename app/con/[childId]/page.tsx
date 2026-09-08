import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { viewingFamilyId } from '@/lib/auth';
import { getChild, listAssignments, soDiem, taoNhiemVuNgay, todayISO } from '@/lib/store';
import type { Assignment, HwSource, NhomNhiemVu } from '@/lib/types';
import { HW_SOURCES, NHOM_NHIEM_VU } from '@/lib/types';
import TickHomNay from './TickHomNay';
import ViecNhaBai from './ViecNhaBai';

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

  const today = todayISO();
  const tomorrow = todayISO(1);

  // Hai truy van chay SONG SONG. Neon la HTTP nen moi cau la mot vong goi rieng;
  // cho cau nay xong moi goi cau kia la cong them mot vong khong can thiet vao
  // dung man hinh con quay ve nhieu nhat.
  //
  // getChild loc theo nha: con cua nha khac coi nhu khong ton tai, du co dung
  // dung link. Cac con khong dang nhap nen day la lop chan duy nhat.
  //
  // Tu hom nay tro di: bai qua han khong hien nua, khong thi danh sach cu dai mai
  // includeChores: true — viec nha (issue #36) gio la dong assignments THAT,
  // xep thanh nhom rieng CUOI CUNG ben duoi. Moi noi goi listAssignments KHAC
  // trong app (man bo me, progressUpcoming) khong xin co nay nen tu dong giu
  // nguyen hanh vi cu, chi trang nay + tinh celebrate o bai/[id]/page.tsx la
  // can thay ca viec nha.
  //
  // soDiem: diem dang co cua con, hien o goc tren canh nut "Doi thuong" — cau
  // thu ba chay song song cung ly do tren.
  //
  // taoNhiemVuNgay TRUOC ba cau do (issue #42, Q2): dong nhiem vu cua HOM NAY
  // cho con nay duoc tao luoi ngay luc mo man, ke ca ngay khong co bai — phai
  // xong roi listAssignments moi thay chung. Khong co gi de chen thi no-op re.
  await taoNhiemVuNgay(familyId, today, [childId]);
  const [child, items, diem] = await Promise.all([
    getChild(familyId, childId),
    listAssignments(familyId, { childId, from: today, includeChores: true }),
    soDiem(familyId, childId),
  ]);
  if (!child) notFound();

  // Nut sang cua hang phan thuong, mang theo so ⭐ dang co. Dung o CA HAI nhanh
  // (co bai / khong co bai): con khong co bai hom nay van doi thuong duoc.
  const nutDoiThuong = (
    <Link
      href={`/con/${childId}/thuong`}
      className="inline-flex items-center gap-3 bg-tertiary-fixed text-on-tertiary-fixed rounded-full
                 px-6 min-h-k-tap interactive-shadow shrink-0 whitespace-nowrap"
    >
      <span className="text-k-headline">⭐ {diem}</span>
      <span className="text-k-label">🎁 Đổi thưởng</span>
    </Link>
  );
  const todayItems = items.filter((a) => a.dueDate === today);
  const done = todayItems.filter((a) => a.status === 'done').length;
  // Con bao nhieu thu cua hom nay chua xong (bai that + viec nha). Cac nhom
  // nhiem vu can so nay de biet luc nao tick not viec cuoi cung thi day sang man
  // khen — cung mot y voi `stillTodo` o bai/[id]/page.tsx, dem o day de khong
  // phai them mot luot goi listAssignments nua. Kem theo trang thai tung dong
  // CUA HOM NAY: <TickHomNay> lay do lam moc de cong tru phan con vua tick ma may
  // chu chua thay, cho CA HAI nhom cung mot so dem (xem lib/tickHomNay.ts).
  const todoHomNay = todayItems.length - done;
  const mocHomNay = Object.fromEntries(todayItems.map((a) => [a.id, a.status === 'done']));

  /** listAssignments da sap xep theo due_date tang dan nen chi can gom lien tiep. */
  function gomTheoNgay(mine: Assignment[]): { date: string; items: Assignment[] }[] {
    const byDate: { date: string; items: Assignment[] }[] = [];
    for (const a of mine) {
      const last = byDate[byDate.length - 1];
      if (last && last.date === a.dueDate) last.items.push(a);
      else byDate.push({ date: a.dueDate, items: [a] });
    }
    return byDate;
  }

  // Gom theo NOI GIAO truoc (moi ma trong HW_SOURCES mot nhom), trong moi noi
  // moi gom theo ngay. Con lam xong het bai mot noi roi moi sang noi kia, nen
  // moi noi can mot khoi rieng voi tien do rieng. Nhiem vu hang ngay (a.choreId
  // khong null) bi LOAI khoi day du "source" cua no la gi — chore_id moi la dau
  // hieu that, xem lib/types.ts — roi duoc gom thanh HAI nhom rieng theo
  // a.choreNhom ("Sau khi hoc xong", "Viec nha hang ngay" — issue #42 Q1, khong
  // tron chung mot danh sach), noi CUOI mang (issue #36 muc 7), khong dung
  // HW_SOURCES cho hai nhom do de khong phai them 'viec nha' vao hang so day.
  // Tien do o dau moi nhom (total/done) chi tinh dong cua HOM NAY, giong moi con
  // so khac cua man nay ("x/y xong hom nay", todoHomNay, dieu kien day sang
  // /xong) — xem AGENTS.md, truc thoi gian. Dong cua ngay mai VAN hien duoi tieu
  // de "Ngày mai" nhung khong tinh vao tien do: khong thi con lam xong het phan
  // hom nay ma huy hieu nhom van bao "3/6", khong xanh, khong 🎉.
  const sourceGroups: { key: string; icon: string; label: string; isChores: boolean;
    byDate: { date: string; items: Assignment[] }[]; total: number; done: number;
    xongHet: boolean }[] =
    (Object.keys(HW_SOURCES) as HwSource[])
      .map((source) => {
        const mine = items.filter((a) => a.source === source && a.choreId == null);
        const homNay = mine.filter((a) => a.dueDate === today);
        const done = homNay.filter((a) => a.status === 'done').length;
        return {
          key: source,
          icon: HW_SOURCES[source].icon,
          label: HW_SOURCES[source].label,
          isChores: false,
          byDate: gomTheoNgay(mine),
          total: homNay.length,
          done,
          xongHet: homNay.length > 0 && done === homNay.length,
        };
      })
      // Nhom chi co bai cua ngay mai van phai hien (total = 0 nhung byDate co
      // dong) — loc theo byDate, khong loc theo total.
      .filter((g) => g.byDate.length > 0);

  for (const nhom of Object.keys(NHOM_NHIEM_VU) as NhomNhiemVu[]) {
    // Dong viec nha cu ma daily_chores khong con (choreNhom null) roi vao nhom
    // dau — khong bo rơi dong nao dang 'todo' cua hom nay.
    const choreItems = items.filter((a) =>
      a.choreId != null && (a.choreNhom ?? Object.keys(NHOM_NHIEM_VU)[0]) === nhom
    );
    if (choreItems.length === 0) continue;
    const choreHomNay = choreItems.filter((a) => a.dueDate === today);
    const choreDone = choreHomNay.filter((a) => a.status === 'done').length;
    sourceGroups.push({
      key: `nhiem-vu-${nhom}`,
      icon: NHOM_NHIEM_VU[nhom].icon,
      label: NHOM_NHIEM_VU[nhom].label,
      isChores: true,
      byDate: gomTheoNgay(choreItems),
      total: choreHomNay.length,
      done: choreDone,
      xongHet: choreHomNay.length > 0 && choreDone === choreHomNay.length,
    });
  }

  /* ---- Khong con bai nao sap toi VA khong co nhiem vu nao: man khen thay vi man
     trong (PRD 4.3). Tu issue #42 nhiem vu hien moi ngay nen man nay hau nhu chi
     con hien khi con khong duoc giao nhiem vu nao (bo me tat het / khong giao
     cho con nay). ---- */
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
        {/* max-w-3xl (bo Macbook 06): o 1440px thi tieu de 56px chay het mot dong
            dai ngoang; gioi han khung lai de no xuong hai dong nhu ban thiet ke. */}
        <div className="flex flex-col items-center max-w-3xl">
          <h1 className="text-k-hero text-on-background mb-3">Hôm nay không có bài tập hay nhiệm vụ 🎉</h1>
          <p className="text-k-headline text-on-surface-variant mb-8">{child.name} đi chơi thôi!</p>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/con"
              className="h-k-tap min-w-[280px] xl:min-w-[320px] rounded-3xl border-4 border-primary text-primary
                         flex items-center justify-center px-12 text-k-label hover:bg-primary-fixed transition-colors"
            >
              <span className="material-symbols-outlined mr-3">home</span>Về trang chính
            </Link>
            {nutDoiThuong}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="kid-scope min-h-screen w-full max-w-[1440px] mx-auto flex flex-col p-k-edge">
      {/* Man may tinh: tien do doi sang ben phai tieu de (bo Macbook 02) — cho
          trong ben canh "Bai tap cua ..." tren man 1440px la cho dat no dep nhat. */}
      <header className="flex items-center gap-6 mb-k-stack xl:justify-between">
        <div className="flex items-center gap-6 min-w-0">
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
        </div>

        <div className="flex items-center gap-4 shrink-0 ml-auto">
          {nutDoiThuong}
          {/* Chi hien tu 1280px tro len; duoi nguong do tien do van nam trong the
              o duoi (xl:hidden ben trong the do) — khong nhan doi tren man iPad. */}
          {todayItems.length > 0 && (
            <div className="hidden xl:flex items-center shrink-0 bg-primary-container text-on-primary-container
                            text-k-headline px-8 py-4 rounded-full soft-shadow whitespace-nowrap">
              {done}/{todayItems.length} xong hôm nay
            </div>
          )}
        </div>
      </header>

      {/* Tien do chi tinh bai hom nay: do la thu con phai lam xong truoc khi di choi (PRD 4.3) */}
      {todayItems.length > 0 && (
        <section className="bg-surface-container-low rounded-2xl p-6 mb-k-stack flex items-center gap-k-gutter soft-shadow
                            xl:w-max xl:mx-auto xl:px-10">
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
          <div className="text-k-headline text-on-surface xl:hidden">
            {done}/{todayItems.length} xong hôm nay
          </div>
        </section>
      )}

      {/* TickHomNay chi giu state tick dung chung cho cac nhom nhiem vu ben trong,
          khong dung ra DOM nao — bo cuc cua <main> khong doi. */}
      <TickHomNay todoHomNay={todoHomNay} mocHomNay={mocHomNay}>
      {sourceGroups.map((sg) => (
        <section key={sg.key} className="mb-k-stack last:mb-0">
          {/* Dau moi nhom: noi giao + tien do RIENG cua nhom do, de con lam het
              mot loai bai (vd het bai cua mot ma trong HW_SOURCES) roi moi sang loai kia.
              Hai nhom nhiem vu luon xep cuoi mang sourceGroups (issue #36 muc 7, #42).
              Nhom khong co gi cua hom nay (chi co bai ngay mai) thi KHONG hien chip
              tien do: "0/0 xong" khong noi len dieu gi, ma to xanh + 🎉 cho no thi
              con tuong da xong mot viec chua den luot lam. */}
          <div
            className={`flex items-center gap-4 rounded-2xl p-4 mb-4 soft-shadow ${
              sg.xongHet ? 'bg-success-container' : 'bg-surface-container-low'
            }`}
          >
            <span className="text-5xl shrink-0">{sg.icon}</span>
            <h2 className="text-k-headline text-on-surface flex-1 min-w-0">
              {sg.label}
            </h2>
            {sg.total > 0 && (
              <span
                className={`text-k-label px-5 py-2 rounded-full shrink-0 ${
                  sg.xongHet ? 'bg-success text-white' : 'bg-surface-container-highest text-on-surface'
                }`}
              >
                {sg.xongHet ? '🎉 ' : ''}{sg.done}/{sg.total} {sg.isChores ? 'việc' : 'bài'} xong
              </span>
            )}
          </div>

          {sg.byDate.map((g) => (
            <div key={g.date} className="mb-6 last:mb-0">
              <h3 className="text-k-headline text-on-surface-variant mb-4">
                {nhanNgay(g.date, today, tomorrow)}
              </h3>

              {sg.isChores ? (
                // Nhiem vu: the tick nhe tai cho, KHONG dan sang /bai/[id] — man
                // do co doc to + dong ho dem nguoc + co the quay video, khong hop
                // voi mot viec don gian nhu "tat den hoc" (xem ViecNhaBai.tsx).
                <ViecNhaBai
                  items={g.items}
                  childId={child.id}
                  laHomNay={g.date === today}
                />
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-k-gutter">
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
                  className={`rounded-[32px] p-6 flex items-center xl:items-start justify-between min-h-[160px] relative overflow-hidden ${
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
                  <div className={`flex items-center xl:items-start gap-6 min-w-0 ${isDone ? 'ml-12' : ''}`}>
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
                        className={`text-k-body font-bold line-clamp-2 xl:line-clamp-3 ${
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
                  {/* Anh minh hoa AN tren luoi 3 cot cua man may tinh: the chi con
                      ~430px, giu anh lai la de bai bi cat con vai chu. Cung mot ly le
                      da chot o man chi tiet bai — anh khong giup con hieu them. */}
                  {a.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.imageUrl}
                      alt=""
                      className={`w-24 h-24 rounded-2xl object-cover shrink-0 ml-4 border-4 xl:hidden ${
                        isDone ? 'border-white/50 opacity-70' : 'border-surface-container-highest'
                      }`}
                    />
                  )}
                </Link>
              );
            })}
              </div>
              )}
            </div>
          ))}
        </section>
      ))}
      </TickHomNay>
    </main>
  );
}
