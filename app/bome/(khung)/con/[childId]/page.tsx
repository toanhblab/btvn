import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { getChild, listAssignments, taoNhiemVuNgay, todayISO } from '@/lib/store';
import {
  HW_SOURCES, NHOM_NHIEM_VU, trangThaiVideo,
  type Assignment, type HwSource, type TrangThaiVideo,
} from '@/lib/types';
import XoaBai from './XoaBai';
import BoTick from './BoTick';
import { ChipNoiGiao, ChonNgay, duongDan, type BoLocMan } from './BoLoc';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/** Mau cua the 🎥 theo trang thai video (lib/types.ts trangThaiVideo). */
const LOP_THE_VIDEO: Record<TrangThaiVideo, string> = {
  'da-nop': 'bg-success-container text-on-success-container',
  'da-don': 'bg-surface-container text-on-surface-variant',
  'chua-quay': 'bg-secondary-container text-on-secondary-container',
};

/**
 * `?nguon=` -> mot ma nguon HOP LE, hoac khong loc gi.
 *
 * KHONG dung hwSourceOf o day: ham do degrade gia tri la ve primary_school, dung
 * cho mot bai dang duoc GHI vao DB, nhung o day gia tri la nghia la "khong hieu
 * bo loc nay" — im lang doi sang Nguyen Sieu thi bo me nhin danh sach da loc ma
 * tuong la ca danh sach.
 */
function locNguon(v: string | undefined): HwSource | undefined {
  return v && v in HW_SOURCES ? (v as HwSource) : undefined;
}

/** `?ngay=` -> mot ngay CO THAT dang YYYY-MM-DD, hoac khong loc gi. */
function locNgay(v: string | undefined): string | undefined {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  // '2026-02-31' dung dang ma khong co that -> Date tu don sang 03-03, doi chieu
  // lai chuoi de bat
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : undefined;
}

/** dd/mm — ngay ngan gon de nhet vao tieu de tien do, khong phai ca chuoi ISO. */
const ngayNgan = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Chi tiet hoc tap cua mot con — nen tu stitch-parent 09. */
export default async function ChiTietCon({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ pham_vi?: string; nguon?: string; ngay?: string }>;
}) {
  const { childId } = await params;
  const { pham_vi, nguon, ngay } = await searchParams;
  const nguonLoc = locNguon(nguon);
  const ngayLoc = locNgay(ngay);
  // Chon mot ngay cu the thi hai chip Hom nay / Tuan nay deu tat: danh sach dang
  // hien khong phai pham vi cua chip nao ca.
  const tuanNay = !ngayLoc && pham_vi === 'tuan';
  const T = await chu();

  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const child = await getChild(familyId, childId);
  if (!child) notFound();

  const today = todayISO();

  // Tao dong nhiem vu hom nay cho con nay neu chua co (issue #42): bo me mo man
  // nay truoc khi con mo man cua con (hay truoc khi ai mo man chon-con) van phai
  // thay dung danh sach hom nay. Idempotent, khong co gi de chen thi no-op.
  await taoNhiemVuNgay(familyId, today, [childId]);

  // Nhiem vu hang ngay lay rieng va CHI CHO HOM NAY, ke ca khi dang xem tab "Tuan nay":
  // no la viec cua buoi toi hom nay, khong phai bai tap co han. Cung vi the no
  // khong duoc cong vao tien do bai tap ngay duoi (co nay: listAssignments voi
  // includeChores mac dinh false).
  //
  // O man tong quan thi KHAC, va la co y: hai o "Hoàn thành" / "Đang chờ" dem
  // ca dong nhiem vu (total/done cua progressUpcoming KHONG loc theo LOAI), chi
  // o "Quá hạn" moi loai chung ra. Captain da chot giu cach dem gop nay: dung
  // "sua" bang cach them bo loc chore_id vao progressUpcoming.
  //
  // Loc theo NGAY thi lai DUNG va da co: progressUpcoming dem bai tu hom nay tro
  // di nhung nhiem vu CHI hom nay, bang cung mot ham voi man cua con
  // (`veTrenManCuaCon`, lib/nhomNhiemVu.ts) — hai chuyen khac nhau, dung lan.
  //
  // Doc theo CAC DONG THAT da tao cho hom nay (issue #36), KHONG theo cau hinh
  // dang bat (listChores): hai ben lech nhau ngay khi bo me sua danh sach giua
  // chung, va ngay khong ai giao bai thi khong co dong nao duoc tao — bo me
  // phai thay dung thu con dang thay, khong thi "0/3 xong" mai du con khong co
  // gi de tick.
  //
  // Tab "Hom nay" khong loc gi: MOT cau duy nhat roi tach hai phan bang choreId,
  // vi hai ben chi khac moi co includeChores. Moi truong hop KHAC (tuan nay, hay
  // co bo loc cua issue #74) thi pham vi cua hai ben khong con trung nhau nen
  // phai hai cau, cho chay song song — Neon la HTTP nen cho cau nay xong moi goi
  // cau kia la cong them mot vong khong can thiet (nhu chu thich o man cua con).
  //
  // Hai bo loc (nguon, ngay) chi ap cho DANH SACH BAI TAP va tien do cua chinh
  // no. Khoi nhiem vu hang ngay giu nguyen "hom nay, khong loc": no la viec cua
  // buoi toi, khong co noi giao, va issue #74 chi xin loc bai tap.
  const mocNgay = ngayLoc ?? today;
  let items: Assignment[];
  let choreItems: Assignment[];
  if (!tuanNay && !ngayLoc && !nguonLoc) {
    const homNay = await listAssignments(familyId, { childId, date: today, includeChores: true });
    items = homNay.filter((a) => a.choreId == null);
    choreItems = homNay.filter((a) => a.choreId != null);
  } else {
    const phamViNgay = ngayLoc
      ? { date: ngayLoc }
      : tuanNay
        ? { from: todayISO(-6), to: todayISO(6) }
        : { date: today };
    const [bai, homNay] = await Promise.all([
      listAssignments(familyId, { childId, ...phamViNgay, ...(nguonLoc ? { source: nguonLoc } : {}) }),
      listAssignments(familyId, { childId, date: today, includeChores: true }),
    ]);
    items = bai;
    choreItems = homNay.filter((a) => a.choreId != null);
  }
  const soViecXong = choreItems.filter((a) => a.status === 'done').length;

  // Ba bo loc di CUNG nhau: moi link doi mot cai phai cho theo hai cai kia.
  const loc: BoLocMan = {
    phamVi: tuanNay ? 'tuan' : undefined,
    nguon: nguonLoc,
    ngay: ngayLoc,
  };

  const done = items.filter((a) => a.status === 'done').length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  // Nhom theo mon cho de liec
  const groups = items.reduce<Record<string, typeof items>>((acc, a) => {
    (acc[a.subject] ??= []).push(a);
    return acc;
  }, {});

  // Man nay chua co ban thiet ke Macbook (issue #15 de lai): tu 1280px giu
  // nguyen cot hep nhu tren dien thoai, chi khac la co thanh ben trai.
  return (
    <main className="px-p-page pt-4 xl:max-w-lg xl:mx-auto">
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
            {T('Xem như con đang thấy →')}
          </Link>
        </div>
        <Link
          href={`/bome/con/${child.id}/sua`}
          className="min-h-p-tap flex items-center text-on-surface-variant shrink-0 px-1"
          aria-label={T('Sửa hồ sơ của {name}', { name: child.name })}
        >
          <span className="material-symbols-outlined">edit</span>
        </Link>
      </header>

      {/* Hai chip pham vi: bam mot trong hai la BO bo loc mot ngay (ve lai khoang
          ngay), nhung GIU nguyen noi giao dang chon. */}
      <div className="flex gap-2 mb-3">
        {[
          [T('Hôm nay'), duongDan(child.id, { nguon: nguonLoc }), !tuanNay && !ngayLoc],
          [T('Tuần này'), duongDan(child.id, { phamVi: 'tuan', nguon: nguonLoc }), tuanNay],
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

      <ChipNoiGiao childId={child.id} loc={loc} T={T} />
      <ChonNgay childId={child.id} loc={loc} moc={mocNgay} T={T} />

      <section className="mb-5">
        <div className="flex justify-between text-p-body-sm text-on-surface-variant mb-1.5">
          <span>
            {ngayLoc
              ? T('Tiến độ ngày {ngay}', { ngay: ngayNgan(ngayLoc) })
              : tuanNay
                ? T('Tiến độ tuần này')
                : T('Tiến độ hôm nay')}
          </span>
          <span>{T('{done}/{total} bài đã xong', { done, total: items.length })}</span>
        </div>
        <div className="h-2.5 rounded-full bg-surface-container-high overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </section>

      {choreItems.length > 0 && (
        <section className="bg-surface-container-lowest rounded-card card-shadow p-3 mb-5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h2 className="text-p-label uppercase text-on-surface-variant">{T('Nhiệm vụ hàng ngày')}</h2>
            <span className="text-p-body-sm text-on-surface font-bold">
              {T('{done}/{total} xong', { done: soViecXong, total: choreItems.length })}
            </span>
          </div>
          <ul className="flex flex-col gap-1">
            {choreItems.map((c) => {
              const xong = c.status === 'done';
              return (
                <li key={c.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`material-symbols-outlined text-base shrink-0 ${
                        xong ? 'text-success icon-fill' : 'text-outline-variant'
                      }`}
                    >
                      {xong ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span className="shrink-0" aria-hidden>{c.icon}</span>
                    <span
                      className={`text-p-body-sm flex-1 min-w-0 ${
                        xong ? 'text-on-surface-variant line-through' : 'text-on-surface'
                      }`}
                    >
                      {c.content}
                    </span>
                    {/* Nhom + sao cua dong (sao la so da chep luc tao; dong cu truoc
                        migration 016 khong co sao thi khong hien) */}
                    {c.choreNhom && (
                      <span className="text-p-label text-outline shrink-0" title={T(NHOM_NHIEM_VU[c.choreNhom].label)}>
                        {NHOM_NHIEM_VU[c.choreNhom].icon}
                      </span>
                    )}
                    {c.stars !== null && (
                      <span className="text-p-label px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed shrink-0">
                        {c.stars} ⭐
                      </span>
                    )}
                  </div>
                  {/* Dong nhiem vu cung la mot dong assignments (migration 013)
                      nen bo tick di dung mot duong voi bai tap. Nut nam o hang
                      RIENG nhu o the bai tap: nhet vao cung hang thi ten nhiem vu
                      bi ep xuong ba dong tren dien thoai. */}
                  {xong && (
                    <div className="flex pl-6">
                      <BoTick id={c.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {items.length === 0 ? (
        <p className="text-p-body text-on-surface-variant text-center py-10">
          {nguonLoc
            ? T('Không có bài nào ở {noi}.', { noi: T(HW_SOURCES[nguonLoc].label) })
            : ngayLoc
              ? T('Ngày {ngay} chưa có bài nào.', { ngay: ngayNgan(ngayLoc) })
              : tuanNay
                ? T('Tuần này chưa có bài nào.')
                : T('Hôm nay chưa giao bài nào cho {name}.', { name: child.name })}
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
                const trangThaiVideoBai = trangThaiVideo(a);
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
                        {/* Noi giao — sua duoc trong man Sua bai tap neu xep nham */}
                        <span className="text-p-label px-2 py-0.5 rounded-full bg-surface-container text-on-surface">
                          {HW_SOURCES[a.source].icon} {T(HW_SOURCES[a.source].label)}
                        </span>
                        {a.lang === 'en' && (
                          <span className="text-p-label px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
                            🇬🇧 {T('Giọng Anh')}
                          </span>
                        )}
                        {a.media.length > 0 && (
                          <span className="text-p-label px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
                            📎 {T('{n} đính kèm', { n: a.media.length })}
                          </span>
                        )}
                        {/* Bai phai quay video: da nop thi mau "xong" — bam Sua
                            (bieu tuong but) de mo bai ra xem video con quay.
                            Ba trang thai chu khong hai: video da bi don
                            (lib/donVideo.ts) thi URL bi go nhung submittedVideoAt
                            con, va do la cho phan biet "con chua quay" voi "con
                            quay roi, video cu da don" — gop hai cai lam mot la
                            doi the sang "Chờ quay video" cho mot bai con da nop
                            xong tu tuan truoc. */}
                        {a.requiresVideo && (
                          <span
                            className={`text-p-label px-2 py-0.5 rounded-full ${LOP_THE_VIDEO[trangThaiVideoBai]}`}
                          >
                            🎥 {trangThaiVideoBai === 'da-nop'
                              ? T('Đã nộp video')
                              : trangThaiVideoBai === 'da-don'
                                ? T('Đã nộp, video đã dọn')
                                : T('Chờ quay video')}
                          </span>
                        )}
                        {overdue && (
                          <span className="text-p-label px-2 py-0.5 rounded-full bg-error-container text-on-error-container">
                            {T('Quá hạn')} {a.dueDate}
                          </span>
                        )}
                        {tuanNay && !overdue && (
                          <span className="text-p-label text-outline">{a.dueDate}</span>
                        )}
                      </div>
                      {/* Nut bo tick nam o mot hang RIENG duoi cac the: nhet vao
                          hang the thi no lan giua dam nhan nho va bo me khong
                          nhan ra day la thu bam duoc (issue #74). */}
                      {a.status === 'done' && (
                        <div className="mt-2 flex">
                          <BoTick id={a.id} />
                        </div>
                      )}
                    </div>
                    {/* Sua duoc sau khi giao: doi de bai, han, video… (/bome/bai/<id>) */}
                    <Link
                      href={`/bome/bai/${a.id}`}
                      className="text-outline hover:text-primary min-h-p-tap px-1 shrink-0 flex items-center"
                      aria-label={T('Sửa bài tập')}
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
        {T('Thêm bài tập cho {name}', { name: child.name })}
      </Link>
    </main>
  );
}
