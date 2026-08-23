import { notFound, redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { getAssignment, getChild } from '@/lib/store';
import SuaBai from './SuaBai';

export const dynamic = 'force-dynamic';

/**
 * Chi tiet + sua mot bai tap o phia bo me: doi de bai, mon, han, giong doc va
 * them/bo video dinh kem sau khi da luu — truoc day giao xong la het duong sua,
 * go nham chu nao phai xoa bai lam lai.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const assignment = await getAssignment(familyId, id);
  if (!assignment) notFound();

  const child = await getChild(familyId, assignment.childId);

  return (
    <SuaBai
      assignment={assignment}
      childName={child?.name ?? ''}
      blobEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
    />
  );
}
