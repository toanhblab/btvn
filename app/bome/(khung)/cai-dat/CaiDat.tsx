'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CaiDat({ hasAI, hasBlob }: { hasAI: boolean; hasBlob: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');

  async function quenPin() {
    if (!confirm('Quên mã PIN trên thiết bị này? Lần sau mở lại phải nhập PIN.')) return;
    await fetch('/api/pin', { method: 'DELETE' });
    router.push('/con');
    router.refresh();
  }

  return (
    <>
      {/* Trang thai dich vu — de bo me biet ngay vi sao tach bai chua chay */}
      {(!hasAI || !hasBlob) && (
        <section className="bg-error-container rounded-card p-3 mb-4">
          <p className="text-p-body-sm text-on-error-container">
            {!hasAI && 'Chưa cài NOUS_API_KEY nên nút "Tách bài tập" chỉ tách tạm theo dòng. '}
            {!hasBlob && 'Chưa bật Vercel Blob nên ảnh đang lưu tạm trong trang.'}
          </p>
        </section>
      )}

      <button
        onClick={quenPin}
        className="w-full bg-surface-container-lowest rounded-card card-shadow p-3 flex items-center gap-3
                   min-h-p-tap text-left"
      >
        <span className="w-9 h-9 rounded-lg bg-error-container flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-error">logout</span>
        </span>
        <span className="flex-1">
          <span className="block text-p-body text-error font-bold">Quên PIN trên thiết bị này</span>
          <span className="block text-p-body-sm text-on-surface-variant">
            Dùng khi trót tick &quot;nhớ&quot; trên iPad của các con
          </span>
        </span>
      </button>

      {msg && <p className="text-p-body-sm text-on-surface-variant mt-3">{msg}</p>}
    </>
  );
}
