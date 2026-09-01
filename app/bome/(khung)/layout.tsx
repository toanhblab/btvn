import { parentFamilyId } from '@/lib/auth';
import { getFamilyById, listChildren } from '@/lib/store';
import ThanhBen from './ThanhBen';
import ThanhDuoi from './ThanhDuoi';

export const dynamic = 'force-dynamic';

/**
 * Khung chung phan bo me.
 *
 * Duoi 1280px: y nguyen ban dien thoai — cot 32rem giua man, thanh dieu huong
 * duoi. Tu 1280px (`xl:`, co Macbook): thanh ben trai 260px thay cho thanh duoi,
 * phan noi dung dat sang phai 260px va tung man tu chon be ngang cua minh.
 *
 * Chua co familyId thi khong ve thanh ben: tung trang se tu redirect sang
 * /bome/pin, ve thanh ben luc do chi lam nhap nhay mot khung rong.
 */
export default async function BomeLayout({ children }: { children: React.ReactNode }) {
  const familyId = await parentFamilyId();
  const [family, kids] = familyId
    ? await Promise.all([getFamilyById(familyId), listChildren(familyId)])
    : [null, []];

  return (
    <div className="parent-scope min-h-screen xl:pl-[260px]">
      {family && (
        <ThanhBen familyName={family.name} childCount={kids.length} slug={family.slug} />
      )}
      <div className="min-h-screen max-w-lg mx-auto pb-24 xl:max-w-none xl:pb-0">{children}</div>
      <ThanhDuoi />
    </div>
  );
}
