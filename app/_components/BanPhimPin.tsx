'use client';

import { PIN_LEN } from '@/lib/pin';

/**
 * Ban phim so + o hien PIN — nen tu stitch-parent 06.
 *
 * Tach rieng vi gio co bon cho nhap PIN: mo phan bo me, gan may vao nha, tao nha
 * moi, doi PIN. Ban phim to san cua app dung duoc ca tren dien thoai lan iPad.
 *
 * Component nay khong tu goi API: nguoi dung no quyet dinh nhap du so thi lam gi.
 */
export default function BanPhimPin({
  value,
  onChange,
  onFull,
  disabled = false,
  autoSubmit = true,
}: {
  value: string;
  onChange: (next: string) => void;
  onFull?: (pin: string) => void;
  disabled?: boolean;
  /** Du so la goi onFull luon. Tat khi man hinh con o khac de bo me bam Xong. */
  autoSubmit?: boolean;
}) {
  function press(d: string) {
    if (disabled || value.length >= PIN_LEN) return;
    const next = value + d;
    onChange(next);
    if (next.length === PIN_LEN && autoSubmit) onFull?.(next);
  }

  return (
    <>
      <div className="flex gap-3 mb-4">
        {Array.from({ length: PIN_LEN }, (_, i) => (
          <div
            key={i}
            className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center bg-surface-container-lowest
                        ${i < value.length ? 'border-primary' : 'border-outline-variant'}`}
          >
            {i < value.length && <div className="w-3 h-3 rounded-full bg-primary" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            className="w-20 h-20 rounded-full bg-surface-container-lowest card-shadow
                       text-p-headline text-on-surface active:bg-surface-container transition-colors"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          type="button"
          onClick={() => press('0')}
          className="w-20 h-20 rounded-full bg-surface-container-lowest card-shadow
                     text-p-headline text-on-surface active:bg-surface-container transition-colors"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          className="w-20 h-20 rounded-full flex items-center justify-center text-on-surface-variant
                     active:bg-surface-container transition-colors"
          aria-label="Xoá"
        >
          <span className="material-symbols-outlined text-3xl">backspace</span>
        </button>
      </div>
    </>
  );
}
