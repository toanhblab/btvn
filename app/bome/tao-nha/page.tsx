import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import TaoNha from './TaoNha';

export const dynamic = 'force-dynamic';

/** Da co nha va da mo khoa thi khong tao them — di thang vao bang dieu khien. */
export default async function Page() {
  if (await parentFamilyId()) redirect('/bome');
  return <TaoNha />;
}
