'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PIN_LEN } from '@/lib/pin';
import type { Family } from '@/lib/store';

/** Khung the trang o co Macbook — duoi 1280px khong doi gi so voi ban cu. */
const THE =
  'xl:bg-surface-container-lowest xl:rounded-card xl:shadow-[0_2px_8px_rgba(0,0,0,0.10)] xl:p-6 xl:mb-6';

export default function CaiDat({
  family,
  hasAI,
  hasBlob,
}: {
  family: Family;
  hasAI: boolean;
  hasBlob: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  /* ---- Doi ten nha ---- */
  const [name, setName] = useState(family.name);
  const [savingName, setSavingName] = useState(false);

  async function luuTen() {
    setSavingName(true);
    setMsg('');
    setError('');
    try {
      const res = await fetch('/api/families', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Không lưu được');
      setMsg('Đã đổi tên nhà.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được.');
    } finally {
      setSavingName(false);
    }
  }

  /* ---- Doi ma PIN ---- */
  const [moPin, setMoPin] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  async function doiPin() {
    setMsg('');
    setError('');
    if (newPin !== newPin2) return setError('Hai lần nhập mã mới chưa giống nhau.');

    setSavingPin(true);
    try {
      const res = await fetch('/api/pin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPin, newPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Không đổi được');
      setMsg('Đã đổi mã PIN. Lần sau bố mẹ nhập mã mới.');
      setMoPin(false);
      setOldPin('');
      setNewPin('');
      setNewPin2('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không đổi được mã PIN.');
    } finally {
      setSavingPin(false);
    }
  }

  const oPin =
    'w-full rounded-lg border border-outline-variant min-h-p-tap px-3 text-p-body tracking-[0.5em] ' +
    'bg-surface-container-lowest';

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

      {/* Khoi "Link cho iPad cua cac con" da bo han theo yeu cau cua captain o
          issue #15 — ban thiet ke Macbook con ve no nhung khong dung nua. May cua
          con van gan vao nha duoc bang duong nhap PIN o /vao. */}

      {/* ---- Ten nha ---- */}
      <section className={THE}>
      <h2 className="text-p-label uppercase text-on-surface-variant mb-2">Tên nhà</h2>
      <div className="bg-surface-container-lowest rounded-card card-shadow p-3 mb-4 flex gap-2
                      xl:shadow-none xl:p-0 xl:mb-0">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className="flex-1 rounded-lg border border-outline-variant min-h-p-tap px-3 text-p-body
                     bg-surface-container-lowest"
        />
        <button
          onClick={luuTen}
          disabled={savingName || name.trim() === family.name}
          className="rounded-card min-h-p-tap px-4 bg-primary text-on-primary text-p-body font-bold
                     disabled:opacity-40"
        >
          Lưu
        </button>
      </div>

      </section>

      {/* ---- Doi ma PIN ---- */}
      <section className={THE}>
      <h2 className="text-p-label uppercase text-on-surface-variant mb-2">Mã PIN</h2>
      {!moPin ? (
        <button
          onClick={() => { setMoPin(true); setMsg(''); setError(''); }}
          className="w-full bg-surface-container-lowest rounded-card card-shadow p-3 flex items-center gap-3
                     min-h-p-tap text-left mb-4 xl:shadow-none xl:p-0 xl:mb-0"
        >
          <span className="w-9 h-9 rounded-lg bg-primary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary">password</span>
          </span>
          <span className="flex-1">
            <span className="block text-p-body text-on-surface font-bold">Đổi mã PIN</span>
            <span className="block text-p-body-sm text-on-surface-variant">
              Dùng khi các con đã nhìn thấy mã cũ
            </span>
          </span>
          <span className="material-symbols-outlined text-outline">chevron_right</span>
        </button>
      ) : (
        <div className="bg-surface-container-lowest rounded-card card-shadow p-3 mb-4 flex flex-col gap-2
                        xl:shadow-none xl:p-0 xl:mb-0">
          <label className="text-p-label uppercase text-on-surface-variant">Mã PIN hiện tại</label>
          <input
            value={oldPin}
            onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN))}
            inputMode="numeric"
            autoComplete="off"
            className={oPin}
          />

          <label className="text-p-label uppercase text-on-surface-variant mt-1">Mã PIN mới</label>
          <input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN))}
            inputMode="numeric"
            autoComplete="off"
            className={oPin}
          />

          <label className="text-p-label uppercase text-on-surface-variant mt-1">Nhập lại mã mới</label>
          <input
            value={newPin2}
            onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN))}
            inputMode="numeric"
            autoComplete="off"
            className={oPin}
          />

          <p className="text-p-body-sm text-on-surface-variant mt-1">
            Mã PIN cũng là thứ phân biệt nhà mình với nhà khác, nên nếu mã mới đã
            có nhà khác dùng thì phải chọn mã khác. Các thiết bị đang mở sẵn phần
            bố mẹ thì vẫn mở tiếp, mã mới chỉ cần cho những lần mở sau.
          </p>

          <div className="flex gap-2 mt-1">
            <button
              onClick={() => { setMoPin(false); setOldPin(''); setNewPin(''); setNewPin2(''); setError(''); }}
              disabled={savingPin}
              className="flex-1 rounded-card min-h-p-tap h-12 border-2 border-outline-variant
                         text-on-surface-variant text-p-body font-bold disabled:opacity-60"
            >
              Thôi
            </button>
            <button
              onClick={doiPin}
              disabled={savingPin || oldPin.length !== PIN_LEN || newPin.length !== PIN_LEN}
              className="flex-1 rounded-card min-h-p-tap h-12 bg-primary text-on-primary
                         text-p-body font-bold disabled:opacity-40"
            >
              {savingPin ? 'Đang đổi…' : 'Đổi mã PIN'}
            </button>
          </div>
        </div>
      )}

      </section>

      {/* Khoi "Vung nguy hiem" (nut "Quen PIN tren thiet bi nay") da bo han theo
          yeu cau cua captain o issue #17. Duong DELETE /api/pin van con nhung
          khong con giao dien nao goi. */}

      {msg && <p className="text-p-body-sm text-on-surface-variant mt-3">{msg}</p>}
      {error && <p className="text-p-body text-error bg-error-container rounded-card p-3 mt-3">{error}</p>}
    </>
  );
}
