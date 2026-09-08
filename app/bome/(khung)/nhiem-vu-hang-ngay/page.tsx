import Link from 'next/link';
import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { DIEM_NGAY_XONG } from '@/lib/diem';
import { listChildren, listChores } from '@/lib/store';
import { NHOM_NHIEM_VU } from '@/lib/types';
import NhiemVuHangNgay from './NhiemVuHangNgay';

export const dynamic = 'force-dynamic';

/**
 * Man "Nhiem vu hang ngay" cua bo me (issue #42) — trang rieng, vao tu the trong
 * Cai dat va tu dong dan tren man Thuong (Q8: khong them tab thu 6 vao thanh
 * duoi). Man moi, chua co ban Stitch (Q9): dung dung khuon man Thuong
 * (the/nut/khoang cach cua bo bo me, p-*, rounded-card, card-shadow).
 *
 * Chua co ban thiet ke Macbook nen tu 1280px giu cot hep (xl:max-w-lg) nhu cac
 * man bo me khac chua co ban Macbook — xem AGENTS.md.
 */
export default async function Page() {
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const [children, chores] = await Promise.all([listChildren(familyId), listChores(familyId)]);

  return (
    <main className="px-p-page pt-4 xl:max-w-lg xl:mx-auto">
      <header className="flex items-center gap-2 mb-1">
        <Link href="/bome/cai-dat" className="min-h-p-tap flex items-center text-on-surface-variant pr-1" aria-label="Về Cài đặt">
          <span className="material-symbols-outlined text-3xl">arrow_back</span>
        </Link>
        <h1 className="text-p-headline text-on-background">Nhiệm vụ hàng ngày</h1>
      </header>
      <p className="text-p-body-sm text-on-surface-variant mb-5">
        Mỗi ngày — kể cả cuối tuần và ngày không có bài — các nhiệm vụ này hiện trên màn của
        từng con, chia hai nhóm <b>{NHOM_NHIEM_VU.after_study.label}</b> và{' '}
        <b>{NHOM_NHIEM_VU.housework.label}</b>. Bố mẹ và con cùng tick ở đó; tick xong là được ⭐
        của nhiệm vụ ngay, và ngày nào <b>có bài tập</b> mà xong hết cả bài lẫn nhiệm vụ thì được
        thêm +{DIEM_NGAY_XONG} ⭐ (ngày không có bài thì chỉ có ⭐ của từng nhiệm vụ).
        Cả nhà dùng chung một danh sách; sửa chỉ ảnh hưởng những ngày sau, ⭐ đã cộng không bị rút.
      </p>

      <NhiemVuHangNgay initial={chores} cacCon={children} />
    </main>
  );
}
