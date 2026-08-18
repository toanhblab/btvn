'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Thanh dieu huong duoi cung — nen tu stitch-parent 02/04/05.
 * Ban Stitch bi loi hien thi Unicode ("Nhlệm vụ", "CỠ0e0i đ11ầt") nen go lai.
 */
const TABS = [
  { href: '/bome', icon: 'home', label: 'Trang chủ' },
  { href: '/bome/them', icon: 'photo_camera', label: 'Thêm bài' },
  { href: '/bome/nhiem-vu', icon: 'checklist', label: 'Nhiệm vụ' },
  { href: '/bome/cai-dat', icon: 'settings', label: 'Cài đặt' },
];

export default function ThanhDuoi() {
  const path = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-surface-container-lowest border-t border-surface-container-high
                 flex items-stretch z-40 pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map((t) => {
        const active = t.href === '/bome' ? path === '/bome' : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 min-h-p-tap flex flex-col items-center justify-center gap-0.5 py-2
                        ${active ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            <span className={`material-symbols-outlined text-2xl ${active ? 'icon-fill' : ''}`}>
              {t.icon}
            </span>
            <span className="text-p-label">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
