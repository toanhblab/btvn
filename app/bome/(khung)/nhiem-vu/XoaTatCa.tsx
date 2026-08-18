'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Xoa sach bai tap ca nha.
 *
 * Hoi lai NGAY TAI CHO chu khong dung confirm() nhu nut xoa mot bai: xoa het la
 * khong lay lai duoc, va hop thoai cua trinh duyet thi bam nham "OK" rat de.
 * Buoc hai con noi ro con so de bo me thay minh sap xoa bao nhieu.
 *
 * @param total  tong so bai trong DB — co the nhieu hon so bai dang hien tren
 *               man hinh, vi man nay chi liet ke 7 ngay quanh hom nay.
 */
export default function XoaTatCa({ total }: { total: number }) {
  const router = useRouter();
  const [hoi, setHoi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (total === 0) return null;

  async function xoa() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/assignments', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Xoá không được');
      setHoi(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xoá được. Thử lại nhé.');
    } finally {
      setBusy(false);
    }
  }

  if (!hoi) {
    return (
      <button
        onClick={() => setHoi(true)}
        className="w-full rounded-card min-h-p-tap border-2 border-error-container text-error
                   text-p-body-sm font-bold flex items-center justify-center gap-1.5 mb-3"
      >
        <span className="material-symbols-outlined text-xl">delete_sweep</span>
        Xoá tất cả bài tập
      </button>
    );
  }

  return (
    <div className="bg-error-container rounded-card p-3 mb-3">
      <p className="text-p-body text-on-error-container font-bold mb-0.5">
        Xoá tất cả {total} bài tập của cả nhà?
      </p>
      <p className="text-p-body-sm text-on-error-container mb-3">
        Gồm cả bài đã xong và bài ngoài 7 ngày đang hiện ở đây. Không lấy lại được.
      </p>

      {error && <p className="text-p-body-sm text-error mb-2">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => { setHoi(false); setError(''); }}
          disabled={busy}
          className="flex-1 rounded-card min-h-p-tap bg-surface-container-lowest text-on-surface
                     text-p-body-sm font-bold disabled:opacity-60"
        >
          Thôi, giữ lại
        </button>
        <button
          onClick={xoa}
          disabled={busy}
          className="flex-1 rounded-card min-h-p-tap bg-error text-white
                     text-p-body-sm font-bold disabled:opacity-60"
        >
          {busy ? 'Đang xoá…' : `Xoá ${total} bài`}
        </button>
      </div>
    </div>
  );
}
