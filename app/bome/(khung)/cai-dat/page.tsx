import Link from 'next/link';
import { getFamily, listChildren } from '@/lib/store';
import { hasNeon } from '@/lib/db';
import CaiDat from './CaiDat';

export const dynamic = 'force-dynamic';

/**
 * Cai dat — nen tu stitch-parent 05, NHUNG doi noi dung.
 *
 * Ban Stitch co email, "Dang xuat", "Goi dang ky". PRD muc 4.5 chot khong tai
 * khoan / khong email / khong mat khau, va muc 5 de "tai khoan that" ra ngoai
 * pham vi. Nen man nay chuyen thanh: ho so cac con, loi vao man hinh cua con,
 * trang thai he thong, va quen PIN tren thiet bi nay.
 */
export default async function Page() {
  const [children, family] = await Promise.all([listChildren(), getFamily()]);

  return (
    <main className="px-p-page pt-4">
      <h1 className="text-p-headline text-on-background mb-1">Cài đặt</h1>
      <p className="text-p-body-sm text-on-surface-variant mb-5">
        Nhà mình dùng chung một mã PIN, không cần tài khoản.
      </p>

      {/* Loi di sang man hinh cua tre */}
      <Link
        href="/con"
        className="w-full bg-surface-container-lowest rounded-card card-shadow p-3 flex items-center gap-3
                   min-h-p-tap mb-4"
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

      <h2 className="text-p-label uppercase text-on-surface-variant mb-2">Hồ sơ các con</h2>
      <p className="text-p-body-sm text-on-surface-variant mb-2">
        Bấm vào một con để đổi tên, ảnh, lớp và màu riêng.
      </p>
      <div className="flex flex-col gap-p-tight mb-5">
        {children.map((c) => (
          <Link
            key={c.id}
            href={`/bome/con/${c.id}/sua`}
            className="bg-surface-container-lowest rounded-card card-shadow p-3 flex items-center gap-3 min-h-p-tap"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
            <span className="flex-1">
              <span className="block text-p-body text-on-surface font-bold">{c.name}</span>
              <span className="block text-p-body-sm text-on-surface-variant">{c.grade}</span>
            </span>
            <span className="material-symbols-outlined text-outline">chevron_right</span>
          </Link>
        ))}
      </div>

      <h2 className="text-p-label uppercase text-on-surface-variant mb-2">Hệ thống</h2>
      <div className="bg-surface-container-lowest rounded-card card-shadow p-3 mb-4">
        <dl className="text-p-body-sm text-on-surface-variant flex flex-col gap-1">
          <div className="flex justify-between gap-3">
            <dt>Dữ liệu</dt>
            <dd className="text-on-surface">{hasNeon ? 'Neon Postgres' : 'PGlite (máy này)'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Đường dẫn của con</dt>
            <dd className="text-on-surface font-mono text-xs break-all">{family?.slug ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <CaiDat
        hasAI={Boolean(process.env.NOUS_API_KEY)}
        hasBlob={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
      />
    </main>
  );
}
