'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/client';

/**
 * Bo danh dau hoan thanh (issue #74) — con tick nham tren iPad thi bo me sua lai
 * duoc tu may minh.
 *
 * CHI mot chieu done -> todo. Chieu nguoc lai (bo me tick xong HO con) co y
 * khong co: hai hang rao cua con — 50% thoi luong va bai bat buoc quay video —
 * nam o duong PATCH cua con trong app/api/assignments/[id]/route.ts, va chung chi
 * chan khi status = 'done'. Mo them mot nut "Xong" cho bo me la mo mot duong
 * vong qua ca hai.
 *
 * Diem KHONG bi rut lai: score_events chi ghi them, va "cong mot lan" nam o ba
 * unique index partial nen con tick lai sau do cung khong duoc cong doi
 * (lib/tinh-diem.test.ts ghim ca hai chieu).
 *
 * La NUT co chu, khong phai ca dong hay cai icon tick: bo me bam tren dien thoai
 * phai nhin ra ngay day la thu bam duoc.
 */
export default function BoTick({ id }: { id: string }) {
  const T = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function boTick() {
    setBusy(true);
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'todo' }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert(T('Không đổi được. Thử lại nhé.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={boTick}
      disabled={busy}
      className="shrink-0 min-h-p-tap px-3 flex items-center gap-1 rounded-full border
                 border-outline-variant bg-surface-container text-on-surface-variant
                 text-p-body-sm font-bold hover:border-primary hover:text-primary
                 disabled:opacity-50"
    >
      <span className="material-symbols-outlined">undo</span>
      {T('Chưa xong')}
    </button>
  );
}
