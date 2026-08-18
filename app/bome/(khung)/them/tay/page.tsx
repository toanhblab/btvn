import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { listChildren } from '@/lib/store';
import NhapTay from './NhapTay';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  return <NhapTay children={await listChildren(familyId)} />;
}
