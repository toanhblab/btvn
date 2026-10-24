import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { viewingFamilyId } from '@/lib/auth';
import { ngayNhaISO, ngayTiengViet } from '@/lib/ngay';
import { chieuDong } from '@/lib/sqlDiem';
import { getChild, soDiem, soDiemChiTiet, type DongDiem } from '@/lib/store';
import { LY_DO_TRU_TRONG } from '@/lib/types';
import { chu } from '@/lib/i18n/server';
import type { T as TDich } from '@/lib/i18n/chu';

export const dynamic = 'force-dynamic';

/** Hien toi da bay nhieu lan gan nhat — mot con kiem vai lan mot ngay, du vai thang. */
const SO_DONG = 200;

/**
 * So ⭐ cua MOT con — man moi, chua co ban Stitch: cung khuon voi cua hang
 * phan thuong (kid-scope, k-*, mau ho phach cho ⭐). Vao tu vien ⭐ duoi ten
 * con o man "Hôm nay con là ai?".
 *
 * Moi dong la MOT lan so du doi: duoc ⭐ (ngay xong het, xong som, nhiem vu,
 * bo me thuong), doi thuong bo me da duyet, bo me tru. Doc tu dung ba bang cua so du
 * (SQL_SO_DIEM_CHI_TIET, lib/sqlDiem.ts) nen cong ca so lai ra dung con so to o
 * dau man. Yeu cau doi dang cho / bi tu choi KHONG nam o day — chua dong vao
 * so du; con xem chung o cua hang.
 *
 * Khong can PIN (con khong dang nhap, PRD 4.5): getChild loc theo nha cua
 * cookie thiet bi, con nha khac coi nhu khong ton tai.
 */
export default async function SoDiemCuaCon({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const familyId = await viewingFamilyId();
  if (!familyId) redirect('/vao');
  const T = await chu();

  const [child, diem, dong] = await Promise.all([
    getChild(familyId, childId),
    soDiem(familyId, childId),
    soDiemChiTiet(familyId, childId, SO_DONG),
  ]);
  if (!child) notFound();

  const homNay = ngayNhaISO();
  const homQua = ngayNhaISO(new Date(), -1);
  const theoNgay: { ngay: string; dong: DongDiem[] }[] = [];
  for (const d of dong) {
    const ngay = ngayNhaISO(new Date(d.luc));
    const nhom = theoNgay.at(-1);
    if (nhom?.ngay === ngay) nhom.dong.push(d);
    else theoNgay.push({ ngay, dong: [d] });
  }
  const tenNgay = (ngay: string) =>
    ngay === homNay ? T('Hôm nay') : ngay === homQua ? T('Hôm qua') : ngayTiengViet(ngay, T);

  return (
    <main className="kid-scope min-h-dvh w-full max-w-[1100px] mx-auto flex flex-col p-k-edge">
      {/* Cung khuon header voi cua hang phan thuong: nhom back + avatar + tieu de,
          vien ⭐ la nhom thu hai, cho xuong dong tren iPhone. */}
      <header className="flex flex-wrap items-center gap-6 mb-k-stack">
        <div className="flex items-center gap-6 min-w-0">
          <Link
            href="/con"
            aria-label={T('Quay lại')}
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
          <h1 className="text-k-hero text-primary min-w-0 break-words">{T('Sổ ⭐ của {name}', { name: child.name })}</h1>
        </div>

        <div className="flex items-center shrink-0 sm:ml-auto bg-tertiary-fixed text-on-tertiary-fixed
                        text-k-headline px-8 py-4 rounded-full soft-shadow whitespace-nowrap">
          {T('Con có {n} ⭐', { n: diem })}
        </div>
      </header>

      <Link
        href={`/con/${child.id}/thuong`}
        className="self-start mb-k-stack inline-flex items-center gap-3 min-h-k-tap px-8 rounded-full
                   bg-secondary-container text-white text-k-label soft-shadow interactive-shadow"
      >
        🎁 {T('Đổi thưởng')}
      </Link>

      {dong.length === 0 ? (
        <p className="text-k-headline text-on-surface-variant text-center mt-10">
          {T('Con chưa có ⭐ nào. Làm xong bài và nhiệm vụ là được ⭐ ngay!')}
        </p>
      ) : (
        <div className="flex flex-col gap-k-stack">
          {theoNgay.map(({ ngay, dong }) => (
            <section key={ngay}>
              <h2 className="text-k-headline text-on-surface-variant mb-4">{tenNgay(ngay)}</h2>
              <ul className="flex flex-col gap-3">
                {dong.map((d) => (
                  <DongSo key={d.id} d={d} T={T} />
                ))}
              </ul>
            </section>
          ))}
          {dong.length >= SO_DONG && (
            <p className="text-k-body text-on-surface-variant text-center">
              {T('Đang hiện {n} lần gần nhất.', { n: SO_DONG })}
            </p>
          )}
        </div>
      )}
    </main>
  );
}

/** Mot dong cua so: icon, viec gi, va so ⭐ cong (xanh) / tru (do). */
function DongSo({ d, T }: { d: DongDiem; T: TDich }) {
  const cong = chieuDong(d.loai) > 0;
  const { icon, ten, nhan } = moTa(d, T);
  return (
    <li className="flex items-center gap-4 rounded-kid px-6 py-4 soft-shadow bg-surface-container-lowest">
      <span className="text-5xl shrink-0" aria-hidden>{icon}</span>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-k-body font-bold text-on-surface truncate">{ten}</span>
        <span className="text-k-label text-on-surface-variant truncate">{nhan}</span>
      </span>
      <span
        className={`text-k-headline font-bold whitespace-nowrap shrink-0 ${cong ? 'text-success' : 'text-error'}`}
      >
        {cong ? '+' : '−'}{d.points} ⭐
      </span>
    </li>
  );
}

/**
 * Chu cua mot dong: `ten` la thu bo me tu go (noi dung bai, ten phan thuong,
 * ly do) — khong dich; `nhan` la loai dong, chu cua app — qua T().
 */
function moTa(d: DongDiem, T: TDich): { icon: string; ten: string; nhan: string } {
  switch (d.loai) {
    case 'day_complete':
      return { icon: '🎉', ten: T('Xong hết việc của ngày'), nhan: T('Thưởng cả ngày') };
    case 'early_finish':
      return { icon: '⚡', ten: d.ten ?? T('Một bài tập'), nhan: T('Xong sớm') };
    case 'task_done':
      return { icon: d.icon ?? '🧹', ten: d.ten ?? T('Một nhiệm vụ'), nhan: T('Nhiệm vụ hàng ngày') };
    case 'parent_bonus':
      return { icon: '💖', ten: d.ten || T('Bố mẹ khen con'), nhan: T('Bố mẹ thưởng') };
    case 'doi_thuong':
      return { icon: d.icon ?? '🎁', ten: d.ten ?? '', nhan: T('Đổi thưởng') };
    case 'bi_tru':
      return { icon: '✋', ten: d.ten || T(LY_DO_TRU_TRONG), nhan: T('Bố mẹ trừ') };
  }
}
