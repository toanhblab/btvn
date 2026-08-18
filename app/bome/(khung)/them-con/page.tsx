import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { listChildren } from '@/lib/store';
import ThemCon from './ThemCon';

export const dynamic = 'force-dynamic';

/**
 * Them mot con.
 *
 * @param dau  Duoc dan sang ngay sau khi tao nha moi — doi loi chao thanh
 *             "them con dau tien" thay vi "them con".
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ dau?: string }>;
}) {
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin?tiep=/bome/them-con');

  const { dau } = await searchParams;
  const children = await listChildren(familyId);

  return <ThemCon others={children} dauTien={dau === '1' || children.length === 0} />;
}
