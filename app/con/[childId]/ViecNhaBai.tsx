'use client';

import { useState } from 'react';
import type { Assignment } from '@/lib/types';

/**
 * Danh sach viec nha trong nhom "Việc nhà" cuoi trang bai hom nay (issue #36).
 * Tung dong o day la mot dong assignments THAT (chore_id khong null) — tick
 * qua CUNG API voi bai tap thuong (PATCH /api/assignments/:id), KHONG con qua
 * setChoreCheck/daily_chore_checks nua.
 *
 * The rieng, KHONG dung <Link> sang /bai/[id]: man do doc to de bai bang giong
 * noi, co dong ho dem nguoc, co the yeu cau quay video — khong hop cho mot viec
 * don gian nhu "tat den hoc". Bam la tick tai cho, giong het ViecNha.tsx cu o
 * man /xong (da go bo, xem migrations/013_viec_nha_thanh_bai_tap.sql).
 *
 * Bam la ghi ngay (lac quan) roi hoan lai neu API loi: tre bam xong ma the
 * doi mau sau nua giay thi be tuong may hong, bam lai lien tuc.
 */
export default function ViecNhaBai({ items }: { items: Assignment[] }) {
  const [xong, setXong] = useState<string[]>(() =>
    items.filter((a) => a.status === 'done').map((a) => a.id)
  );

  async function tick(a: Assignment) {
    const done = !xong.includes(a.id);
    setXong((ds) => (done ? [...ds, a.id] : ds.filter((x) => x !== a.id)));
    try {
      const res = await fetch(`/api/assignments/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: done ? 'done' : 'todo' }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setXong((ds) => (done ? ds.filter((x) => x !== a.id) : [...ds, a.id]));
    }
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((a) => {
        const done = xong.includes(a.id);
        return (
          <li key={a.id}>
            <button
              onClick={() => tick(a)}
              aria-pressed={done}
              className={`w-full min-h-k-tap flex items-center gap-4 px-5 py-2 rounded-kid text-left
                          border-4 transition-colors interactive-shadow
                          ${done
                            ? 'bg-success-container border-success'
                            : 'bg-surface-container-lowest border-transparent'}`}
            >
              <span
                className={`w-12 h-12 rounded-full shrink-0 border-4 flex items-center justify-center
                            ${done
                              ? 'bg-success border-success text-on-primary'
                              : 'bg-surface-container-lowest border-outline-variant'}`}
              >
                {done && <span className="material-symbols-outlined icon-fill">check</span>}
              </span>
              <span
                className={`flex-1 text-k-body font-bold ${done ? 'text-on-success-container' : 'text-on-surface'}`}
              >
                {a.content}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
