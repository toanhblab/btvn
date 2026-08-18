import { redirect } from 'next/navigation';
import { viewingFamilyId } from '@/lib/auth';

/**
 * May da gan voi mot nha thi vao thang man cua con — day la nguoi dung chinh
 * (PRD muc 6). Chua gan (may la, hoac ban be vao lan dau) thi phai chon nha truoc.
 */
export const dynamic = 'force-dynamic';

export default async function Home() {
  redirect((await viewingFamilyId()) ? '/con' : '/vao');
}
