import { listChildren } from '@/lib/store';
import NhapTay from './NhapTay';

export const dynamic = 'force-dynamic';

export default async function Page() {
  return <NhapTay children={await listChildren()} />;
}
