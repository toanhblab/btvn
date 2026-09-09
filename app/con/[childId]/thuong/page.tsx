import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { viewingFamilyId } from '@/lib/auth';
import { ngayNha } from '@/lib/ngay';
import { getChild, listPenalties, listRedemptions, listRewards, soDiem } from '@/lib/store';
import { LY_DO_TRU_TRONG } from '@/lib/types';
import DoiThuong from './DoiThuong';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * Cua hang phan thuong cua MOT con — man moi, chua co ban Stitch: dung cung
 * token/khoi cua bo tre (kid-scope, k-*, the bo goc 32px, mau ho phach cho ⭐).
 *
 * Con xem danh sach phan thuong bo me da dat (ten, icon, gia ⭐), thay minh dang
 * co bao nhieu ⭐, va xin doi. Diem KHONG bi tru o day: yeu cau nam cho o
 * reward_redemptions (status = 'pending') den khi bo me duyet o /bome/thuong.
 * Moi con chi mot yeu cau dang cho — dang cho thi cac nut "Doi" khoa lai va
 * hien bang bao cho con biet.
 *
 * Khong can PIN (con khong dang nhap, PRD 4.5): getChild loc theo nha cua
 * cookie thiet bi, con nha khac coi nhu khong ton tai.
 *
 * Bi tru ⭐ (issue #43, captain chot phuong an B): con NHIN THAY tung lan bo me
 * tru kem ly do o muc "Bố mẹ đã trừ ⭐" — khong de so ⭐ lang le tut xuong. Bo me
 * de trong ly do thi hien LY_DO_TRU_TRONG, mot cau moi con hoi lai bo me, khong
 * de trong hoac. Mau trung tinh (khong do bao dong): day la thong bao, khong phai
 * loi cua man hinh.
 */
export default async function CuaHangPhanThuong({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const familyId = await viewingFamilyId();
  if (!familyId) redirect('/vao');
  const T = await chu();

  const [child, rewards, diem, lichSu, biTru] = await Promise.all([
    getChild(familyId, childId),
    listRewards(familyId, { enabledOnly: true }),
    soDiem(familyId, childId),
    listRedemptions(familyId, { childId, limit: 6 }),
    listPenalties(familyId, { childId, limit: 5 }),
  ]);
  if (!child) notFound();

  const dangCho = lichSu.find((r) => r.status === 'pending') ?? null;
  const daXuLy = lichSu.filter((r) => r.status !== 'pending').slice(0, 5);

  return (
    <main className="kid-scope min-h-screen w-full max-w-[1440px] mx-auto flex flex-col p-k-edge">
      <header className="flex items-center gap-6 mb-k-stack">
        <Link
          href={`/con/${child.id}`}
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
        <h1 className="text-k-hero text-primary flex-1 min-w-0">{T('Phần thưởng của {name}', { name: child.name })}</h1>

        {/* So ⭐ dang co — to va o goc tren, con nhin vao day roi so voi gia tren
            tung the de biet doi duoc cai nao */}
        <div className="flex items-center shrink-0 bg-tertiary-fixed text-on-tertiary-fixed
                        text-k-headline px-8 py-4 rounded-full soft-shadow whitespace-nowrap">
          {T('Con có {n} ⭐', { n: diem })}
        </div>
      </header>

      <DoiThuong childId={child.id} childName={child.name} rewards={rewards} diem={diem} dangCho={dangCho} />

      {/* Nhung lan da doi gan day — cho con thay bo me da dong y hay chua. Ngan,
          it chu: mot dong mot lan. */}
      {daXuLy.length > 0 && (
        <section className="mt-k-stack">
          <h2 className="text-k-headline text-on-surface-variant mb-4">{T('Đã đổi gần đây')}</h2>
          <ul className="flex flex-col gap-3">
            {daXuLy.map((r) => (
              <li
                key={r.id}
                className={`flex items-center gap-4 rounded-kid px-6 py-4 soft-shadow ${
                  r.status === 'approved' ? 'bg-success-container' : 'bg-surface-container-low'
                }`}
              >
                <span className="text-5xl shrink-0">{r.rewardIcon}</span>
                <span
                  className={`flex-1 min-w-0 text-k-body font-bold truncate ${
                    r.status === 'approved' ? 'text-on-success-container' : 'text-on-surface-variant'
                  }`}
                >
                  {r.rewardName}
                </span>
                <span className="text-k-label text-on-surface-variant whitespace-nowrap">{r.cost} ⭐</span>
                <span
                  className={`text-k-label px-4 py-2 rounded-full whitespace-nowrap ${
                    r.status === 'approved'
                      ? 'bg-success text-white'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  {r.status === 'approved' ? T('✅ Bố mẹ đồng ý') : T('❌ Chưa được')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Nhung lan bo me tru ⭐ — con thay minh bi tru bao nhieu va vi sao */}
      {biTru.length > 0 && (
        <section className="mt-k-stack">
          <h2 className="text-k-headline text-on-surface-variant mb-4">{T('Bố mẹ đã trừ ⭐')}</h2>
          <ul className="flex flex-col gap-3">
            {biTru.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-4 rounded-kid px-6 py-4 soft-shadow bg-surface-container-low"
              >
                <span className="text-k-headline font-bold text-error whitespace-nowrap shrink-0">
                  −{p.points} ⭐
                </span>
                <span className="flex-1 min-w-0 text-k-body font-bold text-on-surface truncate">
                  {p.reason || T(LY_DO_TRU_TRONG)}
                </span>
                <span className="text-k-label text-on-surface-variant whitespace-nowrap">
                  {ngayNha(p.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
