import { notFound } from 'next/navigation';
import { getChild, listChildren } from '@/lib/store';
import SuaHoSo from './SuaHoSo';

export const dynamic = 'force-dynamic';

/**
 * Sua ho so mot con. PRD muc 3: tre chon minh bang ANH va MAU chu khong bang
 * ten, nen bo me phai thay duoc anh that va mau rieng vao — truoc day chi sua
 * duoc bang cach chay lai seed, ma seed thi xoa sach bai tap cu.
 */
export default async function Page({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const [child, all] = await Promise.all([getChild(childId), listChildren()]);
  if (!child) notFound();

  // Truyen ca nha sang de canh bao khi hai con trung mau (xem SuaHoSo).
  return <SuaHoSo child={child} others={all.filter((c) => c.id !== child.id)} />;
}
