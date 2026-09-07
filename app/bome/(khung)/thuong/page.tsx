import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { DIEM_NGAY_XONG, DIEM_XONG_SOM } from '@/lib/diem';
import { listChildren, listRedemptions, listRewards, soDiemTheoCon } from '@/lib/store';
import DuyetThuong from './DuyetThuong';
import PhanThuong from './PhanThuong';

export const dynamic = 'force-dynamic';

/**
 * Man "Thuong" cua bo me — man moi, chua co ban Stitch: dung the/nut/khoang
 * cach cua bo bo me (p-*, rounded-card, card-shadow) giong man Cai dat.
 *
 * Ba phan, tu tren xuong theo muc do can lam ngay:
 *   1. Cho duyet    — yeu cau doi thuong cac con vua gui (DuyetThuong). Duyet
 *                     thi diem moi bi tru; tu choi thi con giu diem, xin lai duoc.
 *   2. Da xu ly     — vai lan gan day, de bo me nho da dong y gi.
 *   3. Phan thuong  — danh sach chung ca nha (PhanThuong): ten, icon, gia ⭐,
 *                     bat/tat, xoa. Con thay dung danh sach nay o cua hang.
 *
 * Chua co ban thiet ke Macbook nen tu 1280px giu cot hep (xl:max-w-lg) nhu
 * cac man bo me khac chua co ban Macbook — xem AGENTS.md.
 */
export default async function Page() {
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const [children, choDuyet, daXuLy, rewards, diem] = await Promise.all([
    listChildren(familyId),
    listRedemptions(familyId, { status: 'pending' }),
    listRedemptions(familyId, { limit: 30 }),
    listRewards(familyId),
    soDiemTheoCon(familyId),
  ]);

  const conCua = new Map(children.map((c) => [c.id, c]));
  const choDuyetHienThi = choDuyet.map((r) => {
    const c = conCua.get(r.childId);
    return {
      redemption: r,
      childName: c?.name ?? '?',
      childAvatar: c?.avatarUrl ?? '',
      childColor: c?.color ?? 'primary',
      diem: diem.get(r.childId) ?? 0,
    };
  });
  const ganDay = daXuLy.filter((r) => r.status !== 'pending').slice(0, 8);

  return (
    <main className="px-p-page pt-4 xl:max-w-lg xl:mx-auto">
      <h1 className="text-p-headline text-on-background mb-1">Thưởng</h1>
      <p className="text-p-body-sm text-on-surface-variant mb-5">
        Xong hết bài một ngày: +{DIEM_NGAY_XONG} ⭐. Mỗi bài làm xong trước khi đồng hồ hết giờ:
        +{DIEM_XONG_SOM} ⭐. Các con dùng ⭐ để đổi phần thưởng bố mẹ đặt ở dưới — bố mẹ duyệt
        thì ⭐ mới bị trừ.
      </p>

      {/* Diem tung con — cung con so tren man chon-con va cua hang */}
      {children.length > 0 && (
        <section className="flex flex-wrap gap-2 mb-5">
          {children.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-2 bg-surface-container-lowest rounded-full card-shadow
                         pl-1 pr-3 py-1 text-p-body-sm text-on-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
              <span className="font-bold">{c.name}</span>
              <span className="text-on-tertiary-fixed-variant font-bold">{diem.get(c.id) ?? 0} ⭐</span>
            </span>
          ))}
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-p-label uppercase text-on-surface-variant mb-2">
          Chờ duyệt{choDuyet.length > 0 ? ` (${choDuyet.length})` : ''}
        </h2>
        <DuyetThuong initial={choDuyetHienThi} />
      </section>

      {ganDay.length > 0 && (
        <section className="mb-6">
          <h2 className="text-p-label uppercase text-on-surface-variant mb-2">Đã xử lý gần đây</h2>
          <ul className="bg-surface-container-lowest rounded-card card-shadow divide-y divide-outline-variant/30">
            {ganDay.map((r) => {
              const c = conCua.get(r.childId);
              return (
                <li key={r.id} className="flex items-center gap-2 p-3">
                  <span className="text-2xl shrink-0">{r.rewardIcon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-p-body text-on-surface truncate">
                      <b>{c?.name ?? '?'}</b> · {r.rewardName}
                    </span>
                    <span className="block text-p-body-sm text-on-surface-variant">
                      {r.cost} ⭐ · {r.decidedAt ? new Date(r.decidedAt).toLocaleDateString('vi-VN') : ''}
                    </span>
                  </span>
                  <span
                    className={`text-p-label px-2 py-0.5 rounded-full shrink-0 ${
                      r.status === 'approved'
                        ? 'bg-success-container text-on-success-container'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {r.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-p-label uppercase text-on-surface-variant mb-2">Danh sách phần thưởng</h2>
        <PhanThuong initial={rewards} />
      </section>
    </main>
  );
}
