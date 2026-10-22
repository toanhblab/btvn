'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/client';

/**
 * Nut "Dang xuat" phan bo me (captain 2026-10-22: "o man hinh bo me lam them nut
 * logout"). Goi `DELETE /api/pin` — chi xoa cookie phien bo me, GIU cookie "may
 * nay la cua nha nao" nen cac con van mo app nhu cu, lan sau bo me nhap lai PIN.
 *
 * Khac nut "Quen PIN tren thiet bi nay" da bo o issue #17: ten do doc nhu "quen
 * mat ma PIN"; nut nay chi dong phan bo me tren may nay.
 *
 * Chuyen trang bang window.location chu khong router.replace: tai lai ca trang de
 * bo dem Router Cache cua Next khong con giu man /bome da dung truoc do.
 */
export default function NutDangXuat({ className }: { className: string }) {
  const T = useT();
  const [dangThoat, setDangThoat] = useState(false);
  const [loi, setLoi] = useState('');

  async function dangXuat() {
    setDangThoat(true);
    setLoi('');
    try {
      const res = await fetch('/api/pin', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      window.location.replace('/bome/pin');
    } catch {
      setDangThoat(false);
      setLoi(T('Không kết nối được. Thử lại nhé.'));
    }
  }

  return (
    <>
      <button type="button" onClick={dangXuat} disabled={dangThoat} className={className}>
        <span className="material-symbols-outlined shrink-0">logout</span>
        <span className="text-p-body-sm font-bold">{dangThoat ? T('Đang đăng xuất…') : T('Đăng xuất')}</span>
      </button>
      {loi && <p className="text-p-body-sm text-error mt-1">{loi}</p>}
    </>
  );
}
