'use client';

import { useState } from 'react';
import type { DailyChore } from '@/lib/types';

/**
 * Danh sach viec nha o man khen — con tick tung viec sau khi lam xong bai cuoi
 * cung cua hom nay (issue #25).
 *
 * O tick ve bang the <span> tron chu khong dung icon Material: moi icon trong app
 * dang bi ghim 24px (xem khoi chu thich o app/globals.css), ma o tick cua tre thi
 * phai to bang ngon tay. Dau check ben trong van la icon 24px, vua dep trong vong
 * tron 48px.
 *
 * Bam la ghi ngay (lac quan) roi hoan lai neu API loi: tre bam xong ma o tick doi
 * mau sau nua giay thi be tuong may hong, bam lai lien tuc.
 */
export default function ViecNha({
  childId,
  chores,
  daTick,
}: {
  childId: string;
  chores: DailyChore[];
  daTick: string[];
}) {
  const [xong, setXong] = useState<string[]>(daTick);

  async function tick(choreId: string) {
    const done = !xong.includes(choreId);
    setXong((ds) => (done ? [...ds, choreId] : ds.filter((x) => x !== choreId)));
    try {
      const res = await fetch('/api/viec-nha/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, choreId, done }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setXong((ds) => (done ? ds.filter((x) => x !== choreId) : [...ds, choreId]));
    }
  }

  const hetViec = xong.length === chores.length;

  return (
    <section className="w-full max-w-2xl xl:max-w-3xl mb-8">
      <h2 className="text-k-headline text-secondary mb-4">Việc nhỏ trước khi đi chơi</h2>

      <ul className="flex flex-col gap-3">
        {chores.map((c) => {
          const done = xong.includes(c.id);
          return (
            <li key={c.id}>
              <button
                onClick={() => tick(c.id)}
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
                  className={`flex-1 text-k-body ${done ? 'text-on-success-container' : 'text-on-surface'}`}
                >
                  {c.content}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {hetViec && (
        <p className="text-k-body text-success mt-4">Con làm hết việc nhà rồi, giỏi thật! 🎉</p>
      )}
    </section>
  );
}
