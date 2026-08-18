'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BanPhimPin from '../../_components/BanPhimPin';

/**
 * Man nhap PIN — nen tu stitch-parent 06.
 *
 * PIN o day khong chi la "dung/sai": no quyet dinh mo ra NHA NAO. Moi nha mot ma
 * rieng nen nhap dung la vao dung nha minh.
 */
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

      <BanPhimPin value={pin} onChange={setPin} onFull={submit} disabled={busy} />

      {error && <p className="text-p-body text-error mt-4 mb-1 text-center max-w-xs">{error}</p>}

      <label className="flex items-start gap-3 mt-6 max-w-xs cursor-pointer">
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

      <Link
        href="/bome/tao-nha"
        className="text-p-body text-primary font-bold min-h-p-tap flex items-center px-3 mt-6"
      >
        Nhà mình chưa có — tạo nhà mới
      </Link>

      <p className="text-p-body-sm text-outline mt-2">Chỉ bố mẹ dùng phần này</p>
    </main>
  );
}
