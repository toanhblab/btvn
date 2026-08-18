'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BanPhimPin from '../../_components/BanPhimPin';
import { PIN_LEN } from '@/lib/pin';

/**
 * Tao nha moi — man dau tien cua ban be bo me khi duoc chia se app.
 *
 * Hai buoc de moi buoc chi hoi mot thu: ten nha, roi ma PIN (nhap hai lan).
 * Nhap hai lan la bat buoc: PIN vua la mat khau vua la danh tinh cua nha, go
 * nham mot so o lan dau la sau nay khong ai vao lai duoc nha do.
 */
export default function TaoNha() {
  const router = useRouter();
  const [buoc, setBuoc] = useState<'ten' | 'pin' | 'pin2'>('ten');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function xongPin(value: string) {
    setPin(value);
    setBuoc('pin2');
    setError('');
  }

  async function xacNhan(value: string) {
    if (value !== pin) {
      setError('Hai lần nhập chưa giống nhau. Nhập lại mã PIN nhé.');
      setPin('');
      setPin2('');
      setBuoc('pin');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Nhà mình', pin: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Hay gap nhat: PIN da co nha khac dung -> quay lai buoc chon PIN
        setError(data.error ?? 'Không tạo được nhà.');
        setPin('');
        setPin2('');
        setBuoc('pin');
        return;
      }
      // Nha moi chua co con nao — di thang sang them con dau tien
      router.push('/bome/them-con?dau=1');
      router.refresh();
    } catch {
      setError('Không kết nối được. Thử lại nhé.');
      setPin2('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto flex flex-col items-center justify-center px-p-page py-8">
      <Link
        href="/vao"
        className="absolute top-4 left-4 flex items-center gap-1 text-on-surface-variant
                   min-h-p-tap px-3 rounded-full hover:bg-surface-container"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        <span className="text-p-body">Quay lại</span>
      </Link>

      <div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-primary text-3xl icon-fill">add_home</span>
      </div>

      {buoc === 'ten' && (
        <>
          <h1 className="text-p-headline text-on-background mb-1 text-center">Tạo nhà mới</h1>
          <p className="text-p-body-sm text-on-surface-variant mb-6 text-center max-w-xs">
            Mỗi nhà có bài tập và các con riêng. Không ai thấy được của nhà khác.
          </p>

          <label className="w-full max-w-xs">
            <span className="text-p-label uppercase text-on-surface-variant block mb-1">Tên nhà</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhà mình"
              maxLength={40}
              className="w-full rounded-lg border border-outline-variant min-h-p-tap px-3 text-p-body
                         placeholder:text-outline bg-surface-container-lowest"
            />
          </label>

          <button
            onClick={() => { setBuoc('pin'); setError(''); }}
            className="w-full max-w-xs mt-5 rounded-card h-14 min-h-p-tap bg-primary text-on-primary
                       text-p-body font-bold card-shadow"
          >
            Tiếp tục
          </button>
        </>
      )}

      {buoc !== 'ten' && (
        <>
          <h1 className="text-p-headline text-on-background mb-1 text-center">
            {buoc === 'pin' ? 'Chọn mã PIN của nhà mình' : 'Nhập lại mã PIN'}
          </h1>
          <p className="text-p-body-sm text-on-surface-variant mb-6 text-center max-w-xs">
            {buoc === 'pin'
              ? `${PIN_LEN} chữ số. Đây là cách bố mẹ vào lại nhà mình, và cũng là thứ phân biệt nhà mình với nhà khác — đừng cho các con biết.`
              : 'Nhập lại cho chắc, gõ nhầm thì sau này không vào lại được.'}
          </p>

          {buoc === 'pin' ? (
            <BanPhimPin key="pin" value={pin} onChange={setPin} onFull={xongPin} disabled={busy} />
          ) : (
            <BanPhimPin key="pin2" value={pin2} onChange={setPin2} onFull={xacNhan} disabled={busy} />
          )}

          <button
            onClick={() => { setBuoc('ten'); setPin(''); setPin2(''); setError(''); }}
            className="text-p-body-sm text-on-surface-variant min-h-p-tap px-3 mt-6"
          >
            Đổi tên nhà
          </button>
        </>
      )}

      {error && <p className="text-p-body text-error mt-4 text-center max-w-xs">{error}</p>}
    </main>
  );
}
