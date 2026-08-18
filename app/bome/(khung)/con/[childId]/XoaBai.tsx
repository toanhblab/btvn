'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Xoa mot bai. Xoa bai cua mot be sinh doi KHONG anh huong be kia vi moi be co
 * ban ghi rieng (PRD 4.4).
 */
export default function XoaBai({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm('Xoá bài tập này?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert('Không xoá được. Thử lại nhé.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="text-outline hover:text-error min-h-p-tap px-1 shrink-0 disabled:opacity-50"
      aria-label="Xoá bài tập"
    >
      <span className="material-symbols-outlined">delete</span>
    </button>
  );
}
