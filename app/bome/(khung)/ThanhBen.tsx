'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Thanh ben trai — chi hien tu 1280px tro len (bo stitch-parent-macbook).
 * Duoi nguong do van la ThanhDuoi nhu cu, hai cai khong bao gio cung hien.
 *
 * Bon tep thiet ke Macbook ve thanh ben KHAC NHAU (dau thanh co bon kieu, ten
 * muc doi giua "Nhiem vu"/"Bai tap" va "Them bai"/"Them moi", mau muc dang chon
 * luc xanh luc cam). Chung sinh roi tung man mot nen lech nhau; lay APP lam
 * chuan: dung y bon muc + bon icon cua ThanhDuoi, mau dang chon la primary.
 */
const TABS = [
  { href: '/bome', icon: 'home', label: 'Trang chủ' },
  { href: '/bome/them', icon: 'photo_camera', label: 'Thêm bài' },
  { href: '/bome/nhiem-vu', icon: 'checklist', label: 'Nhiệm vụ' },
  { href: '/bome/cai-dat', icon: 'settings', label: 'Cài đặt' },
];

export default function ThanhBen({
  familyName,
  childCount,
  slug,
}: {
  familyName: string;
  childCount: number;
  slug: string;
}) {
  const path = usePathname();

  return (
    <aside
      className="hidden xl:flex fixed left-0 inset-y-0 w-[260px] z-40 flex-col
                 bg-surface-container-lowest border-r border-outline-variant/40"
    >
      <div className="px-6 pt-8 pb-6">
        <p className="text-p-headline-md text-on-surface truncate">{familyName}</p>
        {/* Ma nha chi con hien MOT lan trong ca phan bo me o co Macbook (o day).
            Khoi "He thong" ben Cai dat da an di tu 1280px — xem cai-dat/page.tsx */}
        <p className="text-p-label text-on-surface-variant mt-1 truncate">
          {childCount} con · Mã nhà: {slug}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="flex flex-col gap-1 px-2">
          {TABS.map((t) => {
            const active = t.href === '/bome' ? path === '/bome' : path.startsWith(t.href);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-full px-4 min-h-p-tap
                              ${active
                                ? 'bg-primary text-on-primary'
                                : 'text-on-surface-variant hover:bg-primary-fixed/50 hover:text-primary'}`}
                >
                  <span className={`material-symbols-outlined ${active ? 'icon-fill' : ''}`}>
                    {t.icon}
                  </span>
                  <span className="text-p-body-sm font-bold">{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-outline-variant/40">
        <Link
          href="/con"
          className="flex items-start gap-3 rounded-card px-4 py-3 text-on-surface hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined text-primary shrink-0">tablet_android</span>
          <span className="min-w-0">
            <span className="block text-p-body-sm font-bold">Mở màn hình của con</span>
            <span className="block text-p-label text-on-surface-variant">
              Xem đúng những gì các con đang thấy trên iPad
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
