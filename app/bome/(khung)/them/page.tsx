import { listChildren } from '@/lib/store';
import ThemBaiTap from './ThemBaiTap';

export const dynamic = 'force-dynamic';

export default async function Page() {
  return <ThemBaiTap children={await listChildren()} />;
}
