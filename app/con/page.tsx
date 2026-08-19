import Link from 'next/link';
import { redirect } from 'next/navigation';
import { viewingFamilyId } from '@/lib/auth';
import { progressUpcoming } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Man "Hom nay con la ai?" — nen tu Stitch 05.
 *
 * Chi hien cac con CUA NHA GAN VOI MAY NAY. May chua gan nha nao (mo lan dau,
 * hoac xoa du lieu trinh duyet) thi phai chon nha truoc — bang link /nha/<slug>
 * hoac nhap PIN mot lan.
 */
export default async function ChonCon() {
  const familyId = await viewingFamilyId();
  if (!familyId) redirect('/vao');

  const rows = await progressUpcoming(familyId);

  const RING: Record<string, string> = {
    primary: 'border-primary',
    secondary: 'border-secondary-container',
    tertiary: 'border-tertiary-container',
  };
  const NAME: Record<string, string> = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    tertiary: 'text-tertiary',
  };

  return (
    <main className="kid-scope min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Mang mau mo lam nen, thuan trang tri */}
      <div className="absolute top-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-primary-fixed opacity-40 blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-tertiary-fixed opacity-30 blur-3xl -z-10 pointer-events-none" />

      <h1 className="text-k-hero text-on-surface mb-10 text-center px-6">
        {rows.length === 0 ? 'Chưa có bạn nào ở đây' : 'Hôm nay con là ai?'}
      </h1>

      {/* Nha vua tao xong thi chua co con nao — noi ro bo me phai lam gi, khong
          de man hinh trong khong (PRD 4.3: khong bao gio de man trong tay khong) */}
      {rows.length === 0 && (
        <p className="text-k-headline text-on-surface-variant text-center px-10 max-w-2xl">
          Bố mẹ vào phần &quot;Bố mẹ&quot; ở góc dưới, thêm hồ sơ cho các con trước nhé.
        </p>
      )}

      <div className="flex flex-row flex-wrap justify-center items-start gap-12 px-8">
        {rows.map(({ child, total, done }) => {
          const left = total - done;
          return (
            <Link
              key={child.id}
              href={`/con/${child.id}`}
              className="avatar-tap group flex flex-col items-center transition-all duration-300 rounded-[32px] p-2
                         focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-8 focus:ring-offset-background"
            >
              <div className="relative mb-5">
                <div
                  className={`w-[200px] h-[200px] rounded-full bg-surface-container-lowest border-8 ${RING[child.color]}
                              overflow-hidden soft-shadow transition-transform duration-300 group-hover:scale-105`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={child.avatarUrl} alt="" className="w-full h-full object-cover" />
                </div>

                {/* Badge dem so bai con lai. Ban Stitch hardcode "Xong het" cho ca 3 con.
                    Phan biet ro "xong het" (co bai va da lam xong) voi "khong co bai"
                    (hom nay khong duoc giao gi) — hai chuyen khac han nhau. */}
                <span
                  className={`absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-k-label px-4 py-2 rounded-full
                              border-4 border-surface-container-lowest
                              ${
                                total === 0
                                  ? 'bg-surface-container-high text-on-surface-variant'
                                  : left === 0
                                    ? 'bg-success text-white'
                                    : 'bg-secondary-container text-white'
                              }`}
                >
                  {total === 0 ? 'Chưa có bài' : left === 0 ? 'Xong hết 🎉' : `${left} bài`}
                </span>
              </div>

              <div className="bg-surface-container-lowest px-8 py-3 rounded-2xl soft-shadow border-b-4 border-surface-container-high">
                <span className={`text-k-headline ${NAME[child.color]}`}>{child.name}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Loi vao cua bo me — de nho va mo de tre bo qua (PRD 4.5) */}
      <Link
        href="/bome/pin"
        className="absolute bottom-8 right-8 flex items-center gap-2 px-6 py-4 rounded-full
                   text-outline hover:text-on-surface-variant hover:bg-surface-container-low
                   transition-colors min-h-k-tap"
      >
        <span className="material-symbols-outlined text-2xl">settings</span>
        <span className="text-sm font-bold uppercase tracking-wider">Bố mẹ</span>
      </Link>
    </main>
  );
}
