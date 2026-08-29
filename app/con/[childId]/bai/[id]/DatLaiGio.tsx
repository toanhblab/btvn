'use client';

import { useState } from 'react';
import BanPhimPin from '@/app/_components/BanPhimPin';

/**
 * "Bố mẹ đặt lại giờ" — con lo tay bam "Bắt đầu làm" thi bo me xoa moc bat dau
 * de bai ve lai trang thai chua bam.
 *
 * Nut nay nam TREN MAY CUA CON chu khong nam trong phan /bome, va do la chu y:
 * moc bat dau chi song trong localStorage cua chinh may dang lam bai (xem
 * DongHoLamBai), may chu khong giu ban nao. Mot nut dat lai o dien thoai bo me
 * se khong voi toi duoc iPad cua con — bam xong dong ho ben kia van chay. Bo me
 * cam may cua con, go PIN, dong ho dung NGAY.
 *
 * PIN chi duoc KIEM TRA qua /api/pin/kiem-tra, khong mo phien bo me tren may
 * nay: day thuong la iPad dung chung cua cac con (PRD 4.5).
 */
export default function DatLaiGio({ onDatLai }: { onDatLai: () => void }) {
  const [mo, setMo] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function dong() {
    setMo(false);
    setPin('');
    setError('');
  }

  async function kiemTra(value: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/pin/kiem-tra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Mã PIN không đúng.');
        setPin('');
        return;
      }
      dong();
      onDatLai();
    } catch {
      setError('Không kết nối được. Thử lại nhé.');
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Nho va nhat: con dang lam bai khong duoc coi day la mot nut cua minh */}
      <button
        onClick={() => setMo(true)}
        className="text-k-body-sm text-outline hover:text-on-surface-variant
                   px-4 py-2 min-h-k-tap"
      >
        Bố mẹ đặt lại giờ
      </button>

      {mo && (
        <div
          onClick={dong}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center
                     justify-center p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest rounded-[32px] p-8 flex flex-col items-center
                       soft-shadow max-h-full overflow-y-auto"
          >
            <div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-3xl icon-fill">lock</span>
            </div>

            <h2 className="text-p-headline text-on-background text-center mb-1">
              Đặt lại giờ bài này
            </h2>
            <p className="text-p-body-sm text-on-surface-variant text-center mb-6 max-w-xs">
              Bố mẹ nhập mã PIN để xoá giờ đã bấm. Bài quay về &ldquo;Bắt đầu làm&rdquo;, con bấm
              lại từ đầu.
            </p>

            <BanPhimPin value={pin} onChange={setPin} onFull={kiemTra} disabled={busy} />

            {error && <p className="text-p-body text-error mt-4 text-center max-w-xs">{error}</p>}

            <button
              onClick={dong}
              className="text-p-body text-on-surface-variant mt-6 px-4 py-2 min-h-p-tap"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </>
  );
}
