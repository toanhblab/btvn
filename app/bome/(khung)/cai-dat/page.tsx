import Link from 'next/link';
import { redirect } from 'next/navigation';
import { parentFamilyId } from '@/lib/auth';
import { getFamilyById, listChildren } from '@/lib/store';
import { hasNeon } from '@/lib/db';
import CaiDat from './CaiDat';

export const dynamic = 'force-dynamic';

/**
 * Cai dat — nen tu stitch-parent 05 (dien thoai) va stitch-parent-macbook 01
 * (Macbook), NHUNG doi noi dung.
 *
 * Ban Stitch co email, "Dang xuat", "Goi dang ky". PRD muc 4.5 chot khong tai
 * khoan / khong email / khong mat khau, va muc 5 de "tai khoan that" ra ngoai
 * pham vi. Nen man nay chuyen thanh: ho so nha, ho so cac con, doi ma PIN, va
 * quen PIN tren thiet bi nay.
 */
export default async function Page() {
  const familyId = await parentFamilyId();
  if (!familyId) redirect('/bome/pin');

  const [children, family] = await Promise.all([
    listChildren(familyId),
    getFamilyById(familyId),
  ]);
  if (!family) redirect('/bome/pin');

  return (
    <main className="px-p-page pt-4 xl:max-w-[1080px] xl:mx-auto xl:px-12 xl:py-12">
      <h1 className="text-p-headline text-on-background mb-1">Cài đặt</h1>
      <p className="text-p-body-sm text-on-surface-variant mb-5 xl:text-p-body xl:max-w-3xl xl:mb-8">
        Nhà mình dùng chung một mã PIN, không cần tài khoản. Nhà khác dùng mã
        riêng của họ và không thấy được gì của nhà mình.
      </p>

      {/* Tu 1280px chia hai cot (ban thiet ke 01): trai la ho so cac con, phai la
          ten nha / ma PIN / vung nguy hiem. Duoi 1280px hai khung chi la the
          <div> thuong nen thu tu doc van y nguyen ban dien thoai. */}
      <div className="xl:grid xl:grid-cols-2 xl:gap-6 xl:items-start">
        <div>
          {/* Loi di sang man hinh cua tre. Tu 1280px thanh ben trai da co san loi
              nay o day duoi nen bo di cho khoi lap. */}
          <Link
            href="/con"
            className="w-full bg-surface-container-lowest rounded-card card-shadow p-3 flex items-center gap-3
                       min-h-p-tap mb-4 xl:hidden"
          >
            <span className="w-9 h-9 rounded-lg bg-primary-fixed flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary">tablet_android</span>
            </span>
            <span className="flex-1">
              <span className="block text-p-body text-on-surface font-bold">Mở màn hình của con</span>
              <span className="block text-p-body-sm text-on-surface-variant">
                Xem đúng những gì các con đang thấy trên iPad
              </span>
            </span>
            <span className="material-symbols-outlined text-outline">chevron_right</span>
          </Link>

          <section className="xl:bg-surface-container-lowest xl:rounded-card xl:shadow-[0_2px_8px_rgba(0,0,0,0.10)] xl:p-6">
            <h2 className="text-p-label uppercase text-on-surface-variant mb-2">Hồ sơ các con</h2>
            <p className="text-p-body-sm text-on-surface-variant mb-2 xl:mb-4">
              Bấm vào một con để đổi tên, ảnh, lớp, màu riêng — hoặc xoá.
            </p>
            <div className="flex flex-col gap-p-tight mb-3 xl:mb-4">
              {children.map((c) => (
                <Link
                  key={c.id}
                  href={`/bome/con/${c.id}/sua`}
                  className="bg-surface-container-lowest rounded-card card-shadow p-3 flex items-center gap-3
                             min-h-p-tap xl:shadow-none xl:border xl:border-outline-variant/40 xl:p-4"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 xl:w-12 xl:h-12" />
                  <span className="flex-1">
                    <span className="block text-p-body text-on-surface font-bold">{c.name}</span>
                    <span className="block text-p-body-sm text-on-surface-variant">{c.grade}</span>
                  </span>
                  <span className="material-symbols-outlined text-outline">chevron_right</span>
                </Link>
              ))}
            </div>

            <Link
              href="/bome/them-con"
              className="w-full rounded-card min-h-p-tap h-12 border-2 border-primary text-primary
                         text-p-body font-bold flex items-center justify-center gap-1.5 mb-5 xl:mb-0"
            >
              <span className="material-symbols-outlined">person_add</span>
              Thêm con
            </Link>
          </section>

          {/* Khoi "He thong" chi con o ban dien thoai.
              O co Macbook, ma nha da nam san o dau thanh ben trai; de them o day
              nua la bo me doc thay ma nha hai lan tren cung mot man hinh. Ten co
              so du lieu ("Neon Postgres") thi bo me khong dung vao viec gi —
              nhung khi dev tren may that no lai la thu can liec, nen giu lai o
              ban dien thoai chu khong xoa han. */}
          <section className="xl:hidden">
            <h2 className="text-p-label uppercase text-on-surface-variant mb-2">Hệ thống</h2>
            <div className="bg-surface-container-lowest rounded-card card-shadow p-3 mb-4">
              <dl className="text-p-body-sm text-on-surface-variant flex flex-col gap-1">
                <div className="flex justify-between gap-3">
                  <dt>Dữ liệu</dt>
                  <dd className="text-on-surface">{hasNeon ? 'Neon Postgres' : 'PGlite (máy này)'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Mã nhà</dt>
                  <dd className="text-on-surface font-mono text-xs break-all">{family.slug}</dd>
                </div>
              </dl>
            </div>
          </section>
        </div>

        <div>
          <CaiDat
            family={family}
            hasAI={Boolean(process.env.NOUS_API_KEY)}
            hasBlob={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
          />
        </div>
      </div>
    </main>
  );
}
