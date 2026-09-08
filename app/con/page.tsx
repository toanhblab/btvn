import Link from 'next/link';
import { redirect } from 'next/navigation';
import { viewingFamilyId } from '@/lib/auth';
import { DIEM_NGAY_XONG, xepHang } from '@/lib/diem';
import { progressUpcoming } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Huy chuong theo hang; tu hang 4 tro di chi con so. */
const HUY_CHUONG: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * Man "Hom nay con la ai?" — nen tu Stitch 05.
 *
 * Chi hien cac con CUA NHA GAN VOI MAY NAY. May chua gan nha nao (mo lan dau,
 * hoac xoa du lieu trinh duyet) thi phai chon nha truoc — bang link /nha/<slug>
 * hoac nhap PIN mot lan.
 *
 * Diem thuong hien NGAY O DAY, cho ca nha cung thay (captain chot, nguoc voi de
 * xuat "giau di" trong bao cao khao sat vi so anh chi em so bi): moi con mot
 * vien ⭐ duoi ten, va mot bang xep hang chung o duoi. So hien la diem DANG CO
 * (da tru phan thuong da doi) — mot con so duy nhat cho tre 4-6 tuoi, cung con
 * so o cua hang phan thuong; doi thuong thi tut hang la dieu chap nhan.
 */
export default async function ChonCon() {
  const familyId = await viewingFamilyId();
  if (!familyId) redirect('/vao');

  const rows = await progressUpcoming(familyId);
  const bangXepHang = xepHang(rows.map((r) => ({ child: r.child, points: r.points })));
  const chuaAiCoDiem = rows.every((r) => r.points === 0);

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
    <main className="kid-scope min-h-screen flex flex-col items-center justify-center relative overflow-hidden py-8">
      {/* Mang mau mo lam nen, thuan trang tri */}
      <div className="absolute top-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-primary-fixed opacity-40 blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-tertiary-fixed opacity-30 blur-3xl -z-10 pointer-events-none" />

      {/* Khung 1100px (bo Macbook 01): tren man rong, de avatar trai het chieu
          ngang 1440px thi ba con nam xa nhau, mat phai quet ca man moi tim ten. */}
      <div className="w-full max-w-[1100px] mx-auto flex flex-col items-center px-k-edge">
        <h1 className="text-k-hero text-on-surface mb-8 xl:mb-3 text-center">
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
        {rows.map(({ child, total, done, homeworkTodo, points }) => {
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

                {/* Badge dem con bao nhieu thu chua xong. Ban Stitch hardcode "Xong het"
                    cho ca 3 con. Bon trang thai, theo thu tu uu tien:
                      - khong co gi (khong bai, khong nhiem vu)    -> "Chưa có bài"
                      - xong het (co viec va da lam xong)           -> "Xong hết 🎉"
                      - con no BAI THAT                             -> "N bài" (N = bai that
                        con todo — khong dem nhiem vu vao day de so khop voi chu "bài")
                      - het bai that, chi con nhiem vu              -> "N việc"
                    Tu issue #42 nhiem vu hien MOI NGAY (progressUpcoming tao dong hom
                    nay truoc khi dem), nen ngay khong ai giao bai thi badge noi "3 việc"
                    chu KHONG noi "Chưa có bài" nua — con van co duong vao man cua minh
                    de tick. "Chưa có bài" chi con khi con khong duoc giao nhiem vu nao. */}
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
                  {total === 0
                    ? 'Chưa có bài'
                    : left === 0
                      ? 'Xong hết 🎉'
                      : homeworkTodo > 0
                        ? `${homeworkTodo} bài`
                        : `${left} việc`}
                </span>
              </div>

              <div className="bg-surface-container-lowest px-8 py-3 rounded-2xl soft-shadow border-b-4 border-surface-container-high">
                <span className={`text-k-headline ${NAME[child.color]}`}>{child.name}</span>
              </div>

              {/* Diem dang co cua con nay — ngay duoi ten, cho con biet minh co bao
                  nhieu ⭐ truoc ca khi bam vao. Mau ho phach (tertiary-fixed) dung
                  chung cho MOI cho hien ⭐ trong app de con nhan ra "day la sao". */}
              <span className="mt-3 inline-flex items-center gap-1.5 bg-tertiary-fixed text-on-tertiary-fixed
                               text-k-label px-5 py-1.5 rounded-full soft-shadow">
                <span aria-hidden>⭐</span>
                {points}
              </span>
            </Link>
          );
        })}
        </div>

        {/* Bang xep hang — chi co y nghia khi nha co tu hai con. Cung hang khi
            bang diem (xepHang). Ngay ra mat chua ai co diem thi thay huy chuong
            bang mot cau nhac luat de con biet lam gi de duoc sao. */}
        {rows.length >= 2 && (
          <section
            aria-label="Bảng xếp hạng"
            className="mt-10 xl:mt-12 bg-surface-container-lowest rounded-[32px] soft-shadow px-8 py-5
                       flex flex-col items-center gap-4 max-w-full"
          >
            <h2 className="text-k-label uppercase tracking-wider text-on-surface-variant">
              🏆 Bảng xếp hạng
            </h2>
            {chuaAiCoDiem ? (
              <p className="text-k-body text-on-surface-variant text-center">
                Làm xong hết bài và nhiệm vụ một ngày là được {DIEM_NGAY_XONG} ⭐, mỗi nhiệm vụ xong còn được thêm ⭐ nữa!
              </p>
            ) : (
              <ol className="flex flex-row flex-wrap justify-center gap-x-10 gap-y-3">
                {bangXepHang.map(({ child, points, rank }) => (
                  <li key={child.id} className="flex items-center gap-3">
                    <span className="text-[40px] leading-none w-12 text-center" aria-label={`Hạng ${rank}`}>
                      {HUY_CHUONG[rank] ?? <span className="text-k-headline text-outline">{rank}</span>}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={child.avatarUrl}
                      alt=""
                      className={`w-12 h-12 rounded-full object-cover border-4 ${RING[child.color]}`}
                    />
                    <span className={`text-k-headline ${NAME[child.color]}`}>{child.name}</span>
                    <span className="text-k-headline text-on-surface whitespace-nowrap">{points} ⭐</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
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
