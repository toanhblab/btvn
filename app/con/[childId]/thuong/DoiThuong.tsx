'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Redemption, Reward } from '@/lib/types';
import { useT } from '@/lib/i18n/client';

/**
 * Luoi phan thuong + nut "Doi" cua con (POST /api/doi-thuong, khong can PIN).
 *
 * Hai buoc: bam "Doi" mo mot tam hoi "Con muon doi ... ?" roi moi gui — tre bam
 * loan tren the la chuyen thuong, khong de mot cu cham nham gui yeu cau len bo me.
 * Chi hien nut cho phan thuong DU diem; thieu thi the mo di va ghi con thieu bao
 * nhieu, de con biet phai kiem them.
 *
 * Dang co yeu cau cho (dangCho) thi khoa het nut "Doi" va hien bang bao: moi con
 * mot yeu cau mot luc (unique index o migrations/015), may chu cung tu choi.
 *
 * Sau khi gui xong: giu yeu cau moi trong state de bang bao hien NGAY, roi
 * router.refresh() de trang cha doc lai tu may chu.
 */
export default function DoiThuong({
  childId,
  childName,
  rewards,
  diem,
  dangCho: dangChoBanDau,
}: {
  childId: string;
  childName: string;
  rewards: Reward[];
  diem: number;
  dangCho: Redemption | null;
}) {
  const T = useT();
  const router = useRouter();
  const [dangCho, setDangCho] = useState<Redemption | null>(dangChoBanDau);
  const [hoi, setHoi] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function gui(reward: Reward) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/doi-thuong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, rewardId: reward.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? T('Chưa gửi được. Con thử lại nhé!'));
      setDangCho(data.redemption);
      setHoi(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : T('Chưa gửi được. Con thử lại nhé!'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {dangCho && (
        <div className="bg-primary-fixed rounded-kid px-8 py-5 mb-k-stack flex items-center gap-5 soft-shadow">
          <span className="text-6xl shrink-0">{dangCho.rewardIcon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-k-headline text-on-primary-fixed">
              {T('Con đã xin đổi “{name}” ({n} ⭐)', { name: dangCho.rewardName, n: dangCho.cost })}
            </p>
            <p className="text-k-body text-on-primary-fixed-variant">
              {T('Chờ bố mẹ duyệt nhé! 🙏 Được rồi thì bố mẹ sẽ báo con.')}
            </p>
          </div>
          <span className="text-5xl shrink-0 animate-float-slow">⏳</span>
        </div>
      )}

      {rewards.length === 0 ? (
        <div className="bg-surface-container-low rounded-kid p-10 text-center soft-shadow">
          <p className="text-6xl mb-4">🎁</p>
          <p className="text-k-headline text-on-surface mb-2">{T('Chưa có phần thưởng nào')}</p>
          <p className="text-k-body text-on-surface-variant">
            {T('Bố mẹ vào phần "Bố mẹ" → "Thưởng" để thêm phần thưởng cho {name} nhé.', { name: childName })}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-k-gutter">
          {rewards.map((r) => {
            const duDiem = diem >= r.cost;
            const thieu = r.cost - diem;
            return (
              <div
                key={r.id}
                className={`rounded-[32px] p-6 flex items-center gap-6 min-h-[160px] ${
                  duDiem && !dangCho
                    ? 'bg-surface border-[6px] border-tertiary-fixed-dim soft-shadow'
                    : 'bg-surface-container-low opacity-80'
                }`}
              >
                <div className="text-7xl shrink-0">{r.icon}</div>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="text-k-body font-bold text-on-surface line-clamp-2">{r.name}</div>
                  <div className="text-k-headline text-on-tertiary-fixed-variant">{r.cost} ⭐</div>
                  {duDiem ? (
                    <button
                      onClick={() => { setHoi(r); setError(''); }}
                      disabled={busy || dangCho !== null}
                      className="btn-3d-amber text-on-tertiary-fixed rounded-3xl h-k-tap px-8 text-k-label
                                 self-start disabled:opacity-50 disabled:shadow-none"
                    >
                      🎁 {T('Đổi')}
                    </button>
                  ) : (
                    <span className="text-k-body-sm text-on-surface-variant">
                      {T('Còn thiếu {n} ⭐ nữa', { n: thieu })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && !hoi && (
        <p className="text-k-body text-error bg-error-container rounded-kid px-6 py-4 mt-6">{error}</p>
      )}

      {hoi && (
        <div
          onClick={() => !busy && setHoi(null)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-k-edge"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest rounded-[40px] p-12 flex flex-col items-center gap-6
                       soft-shadow max-w-2xl w-full text-center"
          >
            <span className="text-[120px] leading-none">{hoi.icon}</span>
            <h2 className="text-k-hero text-on-background">{T('Đổi {name}?', { name: hoi.name })}</h2>
            <p className="text-k-body text-on-surface-variant">
              {T('Hết {n} ⭐, con còn lại {conLai} ⭐. Bố mẹ duyệt thì mới trừ nhé.', { n: hoi.cost, conLai: diem - hoi.cost })}
            </p>
            {error && <p className="text-k-body text-error">{error}</p>}
            <div className="flex flex-wrap justify-center gap-6 mt-2">
              <button
                onClick={() => setHoi(null)}
                disabled={busy}
                className="h-20 min-w-[200px] rounded-3xl border-4 border-outline-variant text-on-surface-variant
                           text-k-headline px-10 disabled:opacity-60"
              >
                {T('Thôi')}
              </button>
              <button
                onClick={() => gui(hoi)}
                disabled={busy}
                className="btn-3d-primary bg-primary text-on-primary rounded-3xl h-20 min-w-[280px] px-10
                           text-k-headline disabled:opacity-60"
              >
                {busy ? T('Đang gửi…') : T('Gửi cho bố mẹ 🙏')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
