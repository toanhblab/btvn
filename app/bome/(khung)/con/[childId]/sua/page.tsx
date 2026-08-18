import { notFound, redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { getChild, listAssignments, listChildren } from '@/lib/store';
import SuaHoSo from './SuaHoSo';

export const dynamic = 'force-dynamic';

/**
 * Sua ho so mot con. PRD muc 3: tre chon minh bang ANH va MAU chu khong bang
 * ten, nen bo me phai thay duoc anh that va mau rieng vao — truoc day chi sua
 * duoc bang cach chay lai seed, ma seed thi xoa sach bai tap cu.
 */
export default async function Page({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const [child, all, cuaCon] = await Promise.all([
    getChild(familyId, childId),
    listChildren(familyId),
    // Xoa con la xoa luon bai tap cua con do (ON DELETE CASCADE) nen phai noi ro
    // con so truoc khi hoi
    listAssignments(familyId, { childId }),
  ]);
  if (!child) notFound();

  // Truyen ca nha sang de canh bao khi hai con trung mau (xem SuaHoSo).
  return (
    <SuaHoSo
      child={child}
      others={all.filter((c) => c.id !== child.id)}
      soBai={cuaCon.length}
      laConCuoi={all.length === 1}
    />
  );
}
