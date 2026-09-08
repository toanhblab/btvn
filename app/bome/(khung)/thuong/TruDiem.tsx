'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChildColor } from '@/lib/types';
import { LY_DO_TRU_GOI_Y, MAX_CHU_LY_DO_TRU, trangThaiTruDiem } from '@/lib/types';
import { useT } from '@/lib/i18n/client';

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
 * Khong am, nhung CHI MOT nut va CHI MOT duong gui — hai luat o
 * `trangThaiTruDiem` (lib/types.ts, doc chu thich o do):
 *   - Nut gui DUNG con so tren nhan cua no (`soGui`), khong phai mot so khac:
 *     "Trừ hết 5 ⭐" tru dung 5 du trong o dang go 8 va du con vua kiem them ⭐.
 *   - Man nay KHONG tu choi (so ⭐ no dang giu co the da cu, ke ca so 0): go so
 *     hop le la bam duoc. May chu la chot cuoi (truDiem trong lib/store.ts,
 *     transaction co khoa theo con) — no tru `LEAST(so nhan duoc, so du that)`
 *     va chi tu choi khi con khong con ⭐ nao, kem `conLai` de man sua lai vien
 *     ⭐ ngay.
 *
 * `vuaDoi` la lop phu NGAN HAN cua so ⭐ tung con: may chu vua tra `conLai` thi
 * vien doi ngay, khong doi tai lai. Nhung props `initial` moi (bo me duyet mot
 * yeu cau doi thuong ngay ben duoi, con vua tick o iPad, hay router.refresh()
 * cua chinh cho nay) la so THAT moi nhat, nen xoa lop phu di — giu lai la mot
 * man hien hai con so khac nhau cho cung mot so du.
 */
export default function TruDiem({ initial }: { initial: ConDeTru[] }) {
  const T = useT();
  const router = useRouter();
  const [vuaDoi, setVuaDoi] = useState<Record<string, number>>({});
  useEffect(() => {
    setVuaDoi((d) => (Object.keys(d).length === 0 ? d : {}));
  }, [initial]);
  const [chon, setChon] = useState<string | null>(null);
  const [so, setSo] = useState('');
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [vuaTru, setVuaTru] = useState<{ ten: string; so: number; conLai: number } | null>(null);

  const RING: Record<ChildColor, string> = {
    primary: 'ring-primary',
    secondary: 'ring-secondary',
    tertiary: 'ring-tertiary',
  };

  const soDu = (c: ConDeTru) => vuaDoi[c.id] ?? c.diem;
  const con = initial.find((c) => c.id === chon) ?? null;
  const dangCo = con ? soDu(con) : 0;
  const { nut, soGui, canhBao } = trangThaiTruDiem(dangCo, so, T);

  function moCon(id: string) {
    setChon((c) => (c === id ? null : id));
    setSo('');
    setLyDo('');
    setError('');
    setVuaTru(null);
  }

  async function gui() {
    if (!con || nut === null) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/tru-diem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: con.id, points: soGui, reason: lyDo }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.conLai === 'number') setVuaDoi((d) => ({ ...d, [con.id]: data.conLai }));
      router.refresh();
      if (!res.ok) throw new Error(data.error ?? T('Không lưu được'));
      setVuaTru({ ten: con.name, so: data.penalty.points, conLai: data.conLai });
      setChon(null);
      setSo('');
      setLyDo('');
    } catch (e) {
      setError(e instanceof Error ? e.message : T('Không lưu được. Thử lại nhé.'));
    } finally {
      setBusy(false);
    }
  }

  const oNhap =
    'rounded-lg border border-outline-variant min-h-p-tap px-3 text-p-body bg-surface-container-lowest';

  const nhanNut =
    nut === 'truHet'
      ? T('Trừ hết {n} ⭐', { n: soGui ?? 0 })
      : nut === 'tru' && con
        ? T('Trừ {n} ⭐ của {name}', { n: soGui ?? 0, name: con.name })
        : T('Trừ ⭐');

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
              aria-label={T('Trừ ⭐ của {name}', { name: c.name })}
              className={`inline-flex items-center gap-2 rounded-full card-shadow pl-1 pr-3 py-1
                          text-p-body-sm min-h-p-tap
                          ${dang ? `bg-primary-fixed ring-2 ${RING[c.color]}` : 'bg-surface-container-lowest'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              <span className="font-bold text-on-surface">{c.name}</span>
              <span className="text-on-tertiary-fixed-variant font-bold">{soDu(c)} ⭐</span>
              <span className="material-symbols-outlined text-on-surface-variant" aria-hidden>
                {dang ? 'expand_less' : 'remove_circle'}
              </span>
            </button>
          );
        })}
      </div>

      {vuaTru && !con && (
        <p className="mt-2 text-p-body-sm text-on-success-container bg-success-container rounded-card p-3">
          {T('Đã trừ {n} ⭐ của {name}, còn {conLai} ⭐. Con sẽ thấy dòng này kèm lý do ở cửa hàng phần thưởng.', { n: vuaTru.so, name: vuaTru.ten, conLai: vuaTru.conLai })}
        </p>
      )}

      {con && (
        <div className="mt-2 bg-surface-container-low rounded-card p-3 flex flex-col gap-2">
          <p className="text-p-body text-on-surface">
            {T('Trừ ⭐ của {name} — con đang có {n} ⭐', { name: con.name, n: dangCo })}
          </p>

          <div className="flex items-center gap-2">
            <label htmlFor="so-tru" className="text-p-body-sm text-on-surface-variant shrink-0">
              {T('Trừ')}
            </label>
            <input
              id="so-tru"
              value={so}
              onChange={(e) => {
                setSo(e.target.value.replace(/\D/g, '').slice(0, 4));
                setError('');
              }}
              inputMode="numeric"
              autoFocus
              placeholder={T('số ⭐')}
              aria-label={T('Số ⭐ muốn trừ')}
              className={`${oNhap} w-24 text-right ${canhBao ? 'border-error text-error' : ''}`}
            />
            <span className="text-p-body">⭐</span>
            {canhBao && <span className="text-p-body-sm text-error">{canhBao}</span>}
          </div>

          {/* Ly do — con se doc, nen goi y la loi noi voi con */}
          <div className="flex flex-wrap gap-1">
            {LY_DO_TRU_GOI_Y.map((g) => {
              const nhan = T(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setLyDo(nhan)}
                  aria-pressed={lyDo === nhan}
                  className={`rounded-full px-3 min-h-9 text-p-body-sm font-bold
                              ${lyDo === nhan ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface'}`}
                >
                  {nhan}
                </button>
              );
            })}
          </div>
          <input
            value={lyDo}
            onChange={(e) => setLyDo(e.target.value)}
            maxLength={MAX_CHU_LY_DO_TRU}
            placeholder={T('Vì sao? (không bắt buộc — con sẽ đọc dòng này)')}
            aria-label={T('Lý do trừ')}
            className={`${oNhap} w-full`}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => moCon(con.id)}
              disabled={busy}
              className="flex-1 rounded-card min-h-p-tap border-2 border-outline-variant
                         text-on-surface-variant text-p-body-sm font-bold disabled:opacity-60"
            >
              {T('Thôi')}
            </button>
            <button
              type="button"
              onClick={gui}
              disabled={busy || nut === null}
              className="flex-1 rounded-card min-h-p-tap bg-error text-white text-p-body-sm font-bold
                         disabled:opacity-40"
            >
              {busy ? T('Đang lưu…') : nhanNut}
            </button>
          </div>

          {error && (
            <p className="text-p-body text-error bg-error-container rounded-card p-3">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
