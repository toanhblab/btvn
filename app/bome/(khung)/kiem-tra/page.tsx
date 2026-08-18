import { listChildren } from '@/lib/store';
import KiemTraLai from './KiemTraLai';

export const dynamic = 'force-dynamic';

export default async function Page() {
  return <KiemTraLai children={await listChildren()} />;
}
