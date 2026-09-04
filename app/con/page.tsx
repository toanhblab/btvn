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

      {/* Khung 1100px (bo Macbook 01): tren man rong, de avatar trai het chieu
          ngang 1440px thi ba con nam xa nhau, mat phai quet ca man moi tim ten. */}
      <div className="w-full max-w-[1100px] mx-auto flex flex-col items-center px-k-edge">
        <h1 className="text-k-hero text-on-surface mb-10 xl:mb-3 text-center">
          {rows.length === 0 ? 'Chưa có bạn nào ở đây' : 'Hôm nay con là ai?'}
        </h1>

        {/* Cau phu chi co trong ban Macbook (01), ban iPad khong co — nen an duoi
            1280px de man iPad giu y nguyen ban da duyet. mb bu lai cho khong lech. */}
        {rows.length > 0 && (
          <p className="hidden xl:block text-k-body text-on-surface-variant mb-7 text-center">
            Chọn tên của con để bắt đầu học vui nhé!
          </p>
        )}

        {/* Nha vua tao xong thi chua co con nao — noi ro bo me phai lam gi, khong
            de man hinh trong khong (PRD 4.3: khong bao gio de man trong tay khong) */}
        {rows.length === 0 && (
          <p className="text-k-headline text-on-surface-variant text-center mt-6 max-w-2xl">
            Bố mẹ vào phần &quot;Bố mẹ&quot; ở góc dưới, thêm hồ sơ cho các con trước nhé.
          </p>
        )}

        <div className="flex flex-row flex-wrap justify-center items-start gap-12 xl:gap-14 w-full">
        {rows.map(({ child, total, done, homeworkTotal }) => {
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
                  className={`w-[200px] h-[200px] xl:w-[240px] xl:h-[240px] rounded-full bg-surface-container-lowest border-8 ${RING[child.color]}
                              overflow-hidden soft-shadow transition-transform duration-300 group-hover:scale-105`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={child.avatarUrl} alt="" className="w-full h-full object-cover" />
                </div>

                {/* Badge dem so bai con lai. Ban Stitch hardcode "Xong het" cho ca 3 con.
                    Phan biet ro "xong het" (co bai va da lam xong) voi "khong co bai"
                    (hom nay khong duoc giao gi) — hai chuyen khac han nhau.

                    "Khong co bai" xet rieng homeworkTotal (chi bai tap): viec nha
                    mac dinh (#25/#30) hau nhu nha nao cung co san 3 viec, neu xet ca
                    viec nha thi badge nay se gan nhu khong bao gio hien "Chua co bai"
                    nua — trong khi con thuc su khong duoc giao bai gi hom nay thi cung
                    khong co duong nao den man tick viec nha (chi mo tu bai cuoi cung). */}
                <span
                  className={`absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-k-label px-4 py-2 rounded-full
                              border-4 border-surface-container-lowest
                              ${
                                homeworkTotal === 0
                                  ? 'bg-surface-container-high text-on-surface-variant'
                                  : left === 0
                                    ? 'bg-success text-white'
                                    : 'bg-secondary-container text-white'
                              }`}
                >
                  {homeworkTotal === 0 ? 'Chưa có bài' : left === 0 ? 'Xong hết 🎉' : `${left} bài`}
                </span>
              </div>

              <div className="bg-surface-container-lowest px-8 py-3 rounded-2xl soft-shadow border-b-4 border-surface-container-high">
                <span className={`text-k-headline ${NAME[child.color]}`}>{child.name}</span>
              </div>
            </Link>
          );
        })}
        </div>
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
