import ChonNha from './ChonNha';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * Man dau tien cho may chua biet la cua nha nao.
 *
 * Ba loi: nhap PIN de gan may vao nha minh, tao nha moi (ban be vao lan dau),
 * hoac di sang phan bo me.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string }>;
}) {
  const { loi } = await searchParams;
  const T = await chu();
  return (
    <ChonNha
      loiLink={loi === 'link' ? T('Link này không còn dùng được. Nhập mã PIN của nhà mình nhé.') : ''}
    />
  );
}
