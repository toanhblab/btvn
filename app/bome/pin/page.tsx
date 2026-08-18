import { redirect } from 'next/navigation';
import { isParent } from '@/lib/auth';
import NhapPin from './NhapPin';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tiep?: string }>;
}) {
  const { tiep } = await searchParams;
  // Chi nhan duong dan noi bo, tranh bi loi dung de chuyen huong ra ngoai
  const next = tiep && tiep.startsWith('/') && !tiep.startsWith('//') ? tiep : '/bome';

  if (await isParent()) redirect(next);
  return <NhapPin next={next} />;
}
