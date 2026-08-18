'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BanPhimPin from '../_components/BanPhimPin';

/**
 * Gan may nay vao mot nha bang ma PIN.
 *
 * KHONG mo phan bo me — chi cho may biet phai hien danh sach con nao. Nho vay
 * nhap PIN o day tren iPad cua cac con la an toan: cac con van khong vao duoc
 * phan bo me (PRD 4.5).
 *
 * Thuong thi bo me khong can man nay: mo link /nha/<slug> mot lan la xong.
 */
export default function ChonNha({ loiLink }: { loiLink: string }) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(loiLink);
  const [busy, setBusy] = useState(false);

  async function submit(value: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/nha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Mã PIN không đúng.');
        setPin('');
        return;
      }
      router.push('/con');
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
      <div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-primary text-3xl icon-fill">home</span>
      </div>

      <h1 className="text-p-headline text-on-background mb-1 text-center">Đây là máy của nhà nào?</h1>
      <p className="text-p-body-sm text-on-surface-variant mb-6 text-center max-w-xs">
        Nhập mã PIN của nhà mình. Máy sẽ nhớ, các con mở lên là dùng được luôn
        mà không phải nhập gì.
      </p>

      <BanPhimPin value={pin} onChange={setPin} onFull={submit} disabled={busy} />

      {error && <p className="text-p-body text-error mt-4 text-center max-w-xs">{error}</p>}

      <div className="flex flex-col items-center gap-1 mt-8">
        <Link
          href="/bome/tao-nha"
          className="text-p-body text-primary font-bold min-h-p-tap flex items-center px-3"
        >
          Nhà mình chưa có — tạo nhà mới
        </Link>
        <Link
          href="/bome/pin"
          className="text-p-body-sm text-on-surface-variant min-h-p-tap flex items-center px-3"
        >
          Vào phần của bố mẹ
        </Link>
      </div>
    </main>
  );
}
