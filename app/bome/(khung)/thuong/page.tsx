import Link from 'next/link';
import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { DIEM_NGAY_XONG, DIEM_XONG_SOM } from '@/lib/diem';
import { ngayNha } from '@/lib/ngay';
import { listChildren, listPenalties, listRedemptions, listRewards, soDiemTheoCon } from '@/lib/store';
import DuyetThuong from './DuyetThuong';
import PhanThuong from './PhanThuong';
import TruDiem from './TruDiem';

export const dynamic = 'force-dynamic';

/**
 * Man "Thuong" cua bo me — man moi, chua co ban Stitch: dung the/nut/khoang
 * cach cua bo bo me (p-*, rounded-card, card-shadow) giong man Cai dat.
 *
 * Bon phan, tu tren xuong theo muc do can lam ngay:
 *   0. Vien ⭐ tung con — bam mot vien la mo o TRU ⭐ (TruDiem, issue #43): bo me
 *                     go so muon tru + ly do (con se doc). Duoi la "Đã trừ gần đây".
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

  const [children, choDuyet, daXuLy, rewards, diem, daTru] = await Promise.all([
    listChildren(familyId),
    listRedemptions(familyId, { status: 'pending' }),
    listRedemptions(familyId, { limit: 30 }),
    listRewards(familyId),
    soDiemTheoCon(familyId),
    listPenalties(familyId, { limit: 8 }),
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
      <p className="text-p-body-sm text-on-surface-variant mb-2">
        Ngày <b>có bài tập</b> mà xong hết cả bài lẫn nhiệm vụ: +{DIEM_NGAY_XONG} ⭐ (ngày không
        có bài thì chỉ được ⭐ của từng nhiệm vụ). Mỗi bài làm xong trước khi đồng hồ hết giờ:
        +{DIEM_XONG_SOM} ⭐. Mỗi nhiệm vụ hàng ngày tick xong: thêm đúng số ⭐ của nhiệm vụ đó. Các con dùng ⭐ để đổi phần thưởng bố mẹ đặt ở dưới — bố mẹ duyệt thì ⭐ mới bị trừ. Con chưa nghe lời thì bố mẹ trừ ⭐ được, nhưng không bao giờ xuống dưới 0.
      </p>
      {/* Dong dan sang trang cai nhiem vu (issue #42 Q8) — cach kiem ⭐ nam o do */}
      <Link
        href="/bome/nhiem-vu-hang-ngay"
        className="inline-flex items-center gap-1 text-p-body-sm text-primary font-bold mb-5 min-h-p-tap"
      >
        <span className="material-symbols-outlined text-xl">checklist</span>
        Cài nhiệm vụ hàng ngày — giao cho con nào, mấy ⭐
        <span className="material-symbols-outlined text-xl">chevron_right</span>
      </Link>

      {/* Diem tung con — cung con so tren man chon-con va cua hang; bam mot vien
          la mo o tru ⭐ (issue #43). Chi tru, khong cong tay. */}
      {children.length > 0 && (
        <section className="mb-5">
          <TruDiem
            initial={children.map((c) => ({
              id: c.id, name: c.name, avatarUrl: c.avatarUrl, color: c.color, diem: diem.get(c.id) ?? 0,
            }))}
          />
          <p className="text-p-body-sm text-on-surface-variant mt-2">
            Bấm vào tên con để <b>trừ ⭐</b> khi con chưa nghe lời. Con sẽ thấy dòng bị trừ kèm lý do
            ở cửa hàng phần thưởng của con.
          </p>
        </section>
      )}

      {daTru.length > 0 && (
        <section className="mb-6">
          <h2 className="text-p-label uppercase text-on-surface-variant mb-2">Đã trừ gần đây</h2>
          <ul className="bg-surface-container-lowest rounded-card card-shadow divide-y divide-outline-variant/30">
            {daTru.map((p) => {
              const c = conCua.get(p.childId);
              return (
                <li key={p.id} className="flex items-center gap-3 p-3">
                  <span className="text-p-body font-bold text-error shrink-0 w-14 text-right">−{p.points} ⭐</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-p-body text-on-surface truncate">
                      <b>{c?.name ?? '?'}</b>
                      {p.reason ? ` · ${p.reason}` : ''}
                    </span>
                    <span className="block text-p-body-sm text-on-surface-variant">
                      {p.reason ? '' : 'Không ghi lý do · '}
                      {ngayNha(p.createdAt)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
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
                      {r.cost} ⭐ · {r.decidedAt ? ngayNha(r.decidedAt) : ''}
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
