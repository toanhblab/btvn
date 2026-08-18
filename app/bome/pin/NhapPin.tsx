'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const LEN = 4;

/** Man nhap PIN — nen tu stitch-parent 06. */
export default function NhapPin({ next }: { next: string }) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(value: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: value, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Mã PIN không đúng.');
        setPin('');
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('Không kết nối được. Thử lại nhé.');
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  function press(d: string) {
    if (busy || pin.length >= LEN) return;
    const next = pin + d;
    setPin(next);
    if (next.length === LEN) submit(next);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-p-page py-8">
      <Link
        href="/con"
        className="absolute top-4 left-4 flex items-center gap-1 text-on-surface-variant
                   min-h-p-tap px-3 rounded-full hover:bg-surface-container"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        <span className="text-p-body">Màn hình của con</span>
      </Link>

      <div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-primary text-3xl icon-fill">lock</span>
      </div>

      <h1 className="text-p-headline text-on-background mb-6">Nhập mã PIN của bố mẹ</h1>

      <div className="flex gap-3 mb-4">
        {Array.from({ length: LEN }, (_, i) => (
          <div
            key={i}
            className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center bg-surface-container-lowest
                        ${i < pin.length ? 'border-primary' : 'border-outline-variant'}`}
          >
            {i < pin.length && <div className="w-3 h-3 rounded-full bg-primary" />}
          </div>
        ))}
      </div>

      {error && <p className="text-p-body text-error mb-3 text-center max-w-xs">{error}</p>}

      <label className="flex items-start gap-3 mb-6 max-w-xs cursor-pointer">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="w-6 h-6 mt-0.5 accent-primary shrink-0"
        />
        <span className="text-p-body-sm text-on-surface-variant">
          Nhớ trên thiết bị này.{' '}
          {/* PRD 4.5: nho PIN tren iPad dung chung cua cac con thi coi nhu PIN mat tac dung */}
          <strong className="text-error">Đừng tick nếu đây là iPad của các con.</strong>
        </span>
      </label>

      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="w-20 h-20 rounded-full bg-surface-container-lowest card-shadow
                       text-p-headline text-on-surface active:bg-surface-container transition-colors"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => press('0')}
          className="w-20 h-20 rounded-full bg-surface-container-lowest card-shadow
                     text-p-headline text-on-surface active:bg-surface-container transition-colors"
        >
          0
        </button>
        <button
          onClick={() => setPin((p) => p.slice(0, -1))}
          className="w-20 h-20 rounded-full flex items-center justify-center text-on-surface-variant
                     active:bg-surface-container transition-colors"
          aria-label="Xoá"
        >
          <span className="material-symbols-outlined text-3xl">backspace</span>
        </button>
      </div>

      <p className="text-p-body-sm text-outline mt-8">Chỉ bố mẹ dùng phần này</p>
    </main>
  );
}
