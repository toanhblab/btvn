'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChildColor } from '@/lib/types';
import { LY_DO_TRU_GOI_Y, MAX_CHU_LY_DO_TRU } from '@/lib/types';

export interface ConDeTru {
  id: string;
  name: string;
  avatarUrl: string;
  color: ChildColor;
  /** So ⭐ con dang co luc trang render — chi de bo me can, KHONG gui len may chu. */
  diem: number;
}

/**
 * Bo me tru ⭐ cua con khi con chua nghe loi (issue #43): POST /api/tru-diem, CAN PIN.
 *
 * Hang vien tung con (avatar + ten + ⭐) chinh la bo chon: bam mot vien la mo o
 * nhap ngay duoi. Bo me GO SO ⭐ MUON TRU (captain chot cach (b) — khong go tong
 * moi), ghi ly do KHONG bat buoc, co hang nut goi y mot cham. Ly do la thu CON
 * DOC o cua hang, nen cac goi y viet bang loi noi duoc voi con (LY_DO_TRU_GOI_Y).
 *
 * Khong am, hai tang:
 *   - O day khoa nut khi so go > so dang hien, de bo me hieu ngay vi sao.
 *   - May chu la chot cuoi (truDiem trong lib/store.ts, transaction co khoa theo
 *     con): con vua kiem them / mot may khac vua tru thi so tren man nay da cu.
 *     Bi tu choi thi may chu tra `conLai` — hien "chi con N ⭐" + nut "Tru het N ⭐"
 *     (cung khuon "Duyet, tru N ⭐" cua doi thuong). Nut do gui `truHet: true`,
 *     KHONG gui N: may chu tinh lai N tai luc bam, dung so that.
 *
 * Xong thi router.refresh() de vien ⭐ va muc "Đã trừ gần đây" o trang cha doc lai;
 * `conLai` may chu tra ve dung de cap nhat vien ngay, khong doi refresh.
 */
export default function TruDiem({ initial }: { initial: ConDeTru[] }) {
  const router = useRouter();
  const [diemCua, setDiemCua] = useState<Record<string, number>>(
    () => Object.fromEntries(initial.map((c) => [c.id, c.diem]))
  );
  const [chon, setChon] = useState<string | null>(null);
  const [so, setSo] = useState('');
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** So du may chu vua bao khi tu choi — bam "Tru het" thi gui truHet, khong gui so nay. */
  const [conLaiBaoLoi, setConLaiBaoLoi] = useState<number | null>(null);
  const [vuaTru, setVuaTru] = useState<{ ten: string; so: number; conLai: number } | null>(null);

  const RING: Record<ChildColor, string> = {
    primary: 'ring-primary',
    secondary: 'ring-secondary',
    tertiary: 'ring-tertiary',
  };

  const con = initial.find((c) => c.id === chon) ?? null;
  const dangCo = con ? diemCua[con.id] ?? 0 : 0;
  const soTru = Number(so);
  const soHopLe = Number.isInteger(soTru) && soTru > 0;
  const quaSo = soHopLe && soTru > dangCo;

  function moCon(id: string) {
    setChon((c) => (c === id ? null : id));
    setSo('');
    setLyDo('');
    setError('');
    setConLaiBaoLoi(null);
    setVuaTru(null);
  }

  async function gui(truHet: boolean) {
    if (!con) return;
    setBusy(true);
    setError('');
    setConLaiBaoLoi(null);
    try {
      const res = await fetch('/api/tru-diem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          truHet
            ? { childId: con.id, truHet: true, reason: lyDo }
            : { childId: con.id, points: soTru, reason: lyDo }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.conLai === 'number') setDiemCua((d) => ({ ...d, [con.id]: data.conLai }));
      if (!res.ok) {
        if (typeof data.conLai === 'number') setConLaiBaoLoi(data.conLai);
        throw new Error(data.error ?? 'Không lưu được');
      }
      setVuaTru({ ten: con.name, so: data.penalty.points, conLai: data.conLai });
      setChon(null);
      setSo('');
      setLyDo('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được. Thử lại nhé.');
    } finally {
      setBusy(false);
    }
  }

  const oNhap =
    'rounded-lg border border-outline-variant min-h-p-tap px-3 text-p-body bg-surface-container-lowest';

  return (
    <div>
      {/* Vien ⭐ tung con — cung con so tren man chon-con va cua hang; bam de tru */}
      <div className="flex flex-wrap gap-2">
        {initial.map((c) => {
          const dang = chon === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => moCon(c.id)}
              aria-pressed={dang}
              aria-label={`Trừ ⭐ của ${c.name}`}
              className={`inline-flex items-center gap-2 rounded-full card-shadow pl-1 pr-3 py-1
                          text-p-body-sm min-h-p-tap
                          ${dang ? `bg-primary-fixed ring-2 ${RING[c.color]}` : 'bg-surface-container-lowest'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              <span className="font-bold text-on-surface">{c.name}</span>
              <span className="text-on-tertiary-fixed-variant font-bold">{diemCua[c.id] ?? 0} ⭐</span>
              <span className="material-symbols-outlined text-on-surface-variant" aria-hidden>
                {dang ? 'expand_less' : 'remove_circle'}
              </span>
            </button>
          );
        })}
      </div>

      {vuaTru && !con && (
        <p className="mt-2 text-p-body-sm text-on-success-container bg-success-container rounded-card p-3">
          Đã trừ {vuaTru.so} ⭐ của <b>{vuaTru.ten}</b>, còn {vuaTru.conLai} ⭐. Con sẽ thấy dòng này
          kèm lý do ở cửa hàng phần thưởng.
        </p>
      )}

      {con && (
        <div className="mt-2 bg-surface-container-low rounded-card p-3 flex flex-col gap-2">
          <p className="text-p-body text-on-surface">
            Trừ ⭐ của <b>{con.name}</b> — con đang có <b>{dangCo} ⭐</b>
          </p>

          <div className="flex items-center gap-2">
            <label htmlFor="so-tru" className="text-p-body-sm text-on-surface-variant shrink-0">
              Trừ
            </label>
            <input
              id="so-tru"
              value={so}
              onChange={(e) => { setSo(e.target.value.replace(/\D/g, '').slice(0, 4)); setConLaiBaoLoi(null); }}
              inputMode="numeric"
              autoFocus
              placeholder="số ⭐"
              aria-label="Số ⭐ muốn trừ"
              className={`${oNhap} w-24 text-right ${quaSo ? 'border-error text-error' : ''}`}
            />
            <span className="text-p-body">⭐</span>
            {quaSo && (
              <span className="text-p-body-sm text-error">Con chỉ có {dangCo} ⭐</span>
            )}
          </div>

          {/* Ly do — con se doc, nen goi y la loi noi voi con */}
          <div className="flex flex-wrap gap-1">
            {LY_DO_TRU_GOI_Y.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setLyDo(g)}
                aria-pressed={lyDo === g}
                className={`rounded-full px-3 min-h-9 text-p-body-sm font-bold
                            ${lyDo === g ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface'}`}
              >
                {g}
              </button>
            ))}
          </div>
          <input
            value={lyDo}
            onChange={(e) => setLyDo(e.target.value)}
            maxLength={MAX_CHU_LY_DO_TRU}
            placeholder="Vì sao? (không bắt buộc — con sẽ đọc dòng này)"
            aria-label="Lý do trừ"
            className={`${oNhap} w-full`}
          />

          {conLaiBaoLoi !== null && conLaiBaoLoi > 0 ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConLaiBaoLoi(null)}
                disabled={busy}
                className="flex-1 rounded-card min-h-p-tap border-2 border-outline-variant
                           text-on-surface-variant text-p-body-sm font-bold disabled:opacity-60"
              >
                Thôi
              </button>
              <button
                type="button"
                onClick={() => gui(true)}
                disabled={busy}
                className="flex-1 rounded-card min-h-p-tap bg-error text-white text-p-body-sm font-bold
                           disabled:opacity-60"
              >
                {busy ? 'Đang lưu…' : `Trừ hết ${conLaiBaoLoi} ⭐`}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => moCon(con.id)}
                disabled={busy}
                className="flex-1 rounded-card min-h-p-tap border-2 border-outline-variant
                           text-on-surface-variant text-p-body-sm font-bold disabled:opacity-60"
              >
                Thôi
              </button>
              <button
                type="button"
                onClick={() => gui(false)}
                disabled={busy || !soHopLe || quaSo}
                className="flex-1 rounded-card min-h-p-tap bg-error text-white text-p-body-sm font-bold
                           disabled:opacity-40"
              >
                {busy ? 'Đang lưu…' : soHopLe ? `Trừ ${soTru} ⭐ của ${con.name}` : 'Trừ ⭐'}
              </button>
            </div>
          )}

          {error && (
            <p className="text-p-body text-error bg-error-container rounded-card p-3">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
