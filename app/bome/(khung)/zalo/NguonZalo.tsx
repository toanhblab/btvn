'use client';

import { useState } from 'react';
import type { NguonZalo as Nguon } from '@/lib/nhanBaiZalo';
import {
  CUA_SO_DINH_KEM_MAC_DINH, MAU_NHAN_DIEN_MAC_DINH, MAX_CHU_TEN_CO, MAX_CHU_TEN_NHOM,
  MAX_CUA_SO_DINH_KEM_PHUT,
} from '@/lib/nhanBaiZalo';
import type { Child } from '@/lib/types';
import { gioNha } from '@/lib/ngay';
import { useT } from '@/lib/i18n/client';

/**
 * Hang chip "Con học lớp này".
 *
 * KHAC hang "Giao cho" cua nhiem vu hang ngay o dung mot cho, va do la cho ca
 * man nay khac: khong co chip "Cả nhà". Mot nhom Zalo LA mot lop, nen "cả nhà"
 * khong co nghia — con em chua di hoc khong duoc nhan bai cua lop anh. Tap rong
 * la trang thai that ("chưa chọn con nào") va API tu choi luu.
 */
function ChonCon({ value, onChange, busy, cacCon }: {
  value: string[]; onChange: (v: string[]) => void; busy: boolean; cacCon: Child[];
}) {
  const T = useT();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-p-body-sm text-on-surface-variant mr-0.5">{T('Con học lớp này:')}</span>
      {cacCon.map((ch) => {
        const chon = value.includes(ch.id);
        return (
          <button
            key={ch.id}
            type="button"
            aria-pressed={chon}
            disabled={busy}
            onClick={() => onChange(chon ? value.filter((x) => x !== ch.id) : [...value, ch.id])}
            className={`min-h-9 pl-1 pr-3 rounded-full text-p-body-sm font-bold border flex items-center gap-1.5
                        disabled:opacity-60
                        ${chon
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ch.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
            {ch.name}
          </button>
        );
      })}
      {value.length === 0 && (
        <p className="w-full text-p-body-sm text-error font-bold">
          {T('Chọn ít nhất một con học lớp này.')}
        </p>
      )}
    </div>
  );
}

/**
 * Danh sach "Nhóm Zalo" — khuon NhiemVuHangNgay.tsx: sua tai cho (luu khi roi
 * o), giu state o day vi bo me hay bam lien tay, cong tac bat/tat thay cho nut
 * xoa.
 *
 * KHONG CO NUT XOA, co y: mot nguon da nhan bai la cha cua nhung dong giu
 * NGUYEN VAN tin cua co — ban sao duy nhat cua chung. Tat thi may o nha thoi
 * quet nhom do va cua nhan tu choi tin moi, nhung lich su van con. Ly do day du
 * o PATCH /api/nguon-zalo/:id.
 */
export default function NguonZalo({ initial, cacCon }: { initial: Nguon[]; cacCon: Child[] }) {
  const T = useT();
  const [nguon, setNguon] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [moThem, setMoThem] = useState(false);

  const [themNhom, setThemNhom] = useState('');
  const [themCo, setThemCo] = useState('');
  const [themCon, setThemCon] = useState<string[]>([]);

  async function goi(url: string, init: RequestInit) {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? T('Không lưu được'));
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : T('Không lưu được. Thử lại nhé.'));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function them() {
    if (busy || !themNhom.trim() || !themCo.trim() || themCon.length === 0) return;
    const data = await goi('/api/nguon-zalo', {
      method: 'POST',
      body: JSON.stringify({
        tenNhom: themNhom.trim(),
        tenCo: themCo.trim(),
        childIds: themCon,
        mauNhanDien: MAU_NHAN_DIEN_MAC_DINH,
        cuaSoDinhKemPhut: CUA_SO_DINH_KEM_MAC_DINH,
      }),
    });
    if (!data) return;
    setNguon([...nguon, data.nguon]);
    setThemNhom('');
    setThemCo('');
    setThemCon([]);
    setMoThem(false);
  }

  async function sua(n: Nguon, patch: Partial<Nguon>) {
    const data = await goi(`/api/nguon-zalo/${n.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (data?.nguon) setNguon((ns) => ns.map((x) => (x.id === n.id ? data.nguon : x)));
  }

  const oNhap =
    'rounded-lg border border-outline-variant min-h-p-tap px-3 text-p-body bg-surface-container-lowest';

  return (
    <>
      <div className="flex flex-col gap-p-tight mb-3">
        {nguon.map((n) => (
          <div
            key={n.id}
            className={`bg-surface-container-lowest rounded-card card-shadow p-2 flex flex-col gap-2
                        ${n.dangBat && n.childIds.length > 0 ? '' : 'opacity-70'}`}
          >
            <input
              defaultValue={n.tenNhom}
              key={`${n.id}:nhom:${n.tenNhom}`}
              maxLength={MAX_CHU_TEN_NHOM}
              aria-label={T('Tên nhóm Zalo')}
              onBlur={(e) => {
                const moi = e.target.value.trim();
                if (!moi || moi === n.tenNhom) { e.target.value = n.tenNhom; return; }
                sua(n, { tenNhom: moi });
              }}
              className={`${oNhap} w-full font-bold`}
            />
            <div className="flex gap-2">
              <input
                defaultValue={n.tenCo}
                key={`${n.id}:co:${n.tenCo}`}
                maxLength={MAX_CHU_TEN_CO}
                aria-label={T('Tên cô giáo hiện trên Zalo')}
                onBlur={(e) => {
                  const moi = e.target.value.trim();
                  if (!moi || moi === n.tenCo) { e.target.value = n.tenCo; return; }
                  sua(n, { tenCo: moi });
                }}
                className={`${oNhap} flex-1 min-w-0`}
              />
              <label className="flex items-center gap-1 shrink-0">
                <input
                  defaultValue={n.cuaSoDinhKemPhut}
                  key={`${n.id}:cuaso:${n.cuaSoDinhKemPhut}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_CUA_SO_DINH_KEM_PHUT}
                  aria-label={T('Nhận tệp cô gửi trong bao nhiêu phút sau tin')}
                  onBlur={(e) => {
                    const moi = Number(e.target.value);
                    if (!(moi >= 1 && moi <= MAX_CUA_SO_DINH_KEM_PHUT) || moi === n.cuaSoDinhKemPhut) {
                      e.target.value = String(n.cuaSoDinhKemPhut);
                      return;
                    }
                    sua(n, { cuaSoDinhKemPhut: moi });
                  }}
                  className={`${oNhap} w-20 text-right`}
                />
                <span className="text-p-body-sm text-on-surface-variant">{T('phút')}</span>
              </label>
            </div>

            <ChonCon
              value={n.childIds}
              onChange={(childIds) => { if (childIds.length > 0) sua(n, { childIds }); }}
              busy={busy}
              cacCon={cacCon}
            />

            <div className="flex items-center gap-2">
              {/* KHONG `truncate`: o be ngang 390px, cong tac chiem gan mot nua
                  hang nen mot dong mot dong se cat mat dung phan GIO — ma gio
                  la thu noi nguon con song hay da chet am tham. De no xuong
                  dong; cong tac `shrink-0` nen khong bi day di dau. */}
              <span className="flex-1 min-w-0 text-p-label text-on-surface-variant">
                {n.lanNhanGanNhat
                  ? T('Nhận bài gần nhất: {luc}', { luc: gioNha(n.lanNhanGanNhat) })
                  : T('Chưa nhận bài nào từ nhóm này')}
              </span>
              <button
                onClick={() => sua(n, { dangBat: !n.dangBat })}
                disabled={busy}
                role="switch"
                aria-checked={n.dangBat}
                className="min-h-p-tap flex items-center justify-end gap-2 px-2 disabled:opacity-60 shrink-0"
              >
                <span className="text-p-body-sm text-on-surface-variant">
                  {n.dangBat ? T('Đang bật') : T('Đang tắt')}
                </span>
                <span
                  className={`w-11 h-6 rounded-full flex items-center shrink-0 transition-colors
                              ${n.dangBat ? 'bg-primary' : 'bg-surface-container-high'}`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-surface-container-lowest card-shadow transition-transform
                                ${n.dangBat ? 'translate-x-[22px]' : 'translate-x-[2px]'}`}
                  />
                </span>
              </button>
            </div>
          </div>
        ))}

        {nguon.length === 0 && (
          <p className="text-p-body-sm text-on-surface-variant py-2">
            {T('Chưa khai nhóm Zalo nào. Thêm một nhóm thì bài cô đăng trong nhóm đó sẽ tự vào đây.')}
          </p>
        )}
      </div>

      {moThem ? (
        <div className="bg-surface-container-low rounded-card p-3 flex flex-col gap-2 mb-4">
          <input
            value={themNhom}
            onChange={(e) => setThemNhom(e.target.value)}
            maxLength={MAX_CHU_TEN_NHOM}
            placeholder={T('Tên nhóm Zalo, gõ đúng như trên Zalo')}
            className={`${oNhap} w-full`}
          />
          <input
            value={themCo}
            onChange={(e) => setThemCo(e.target.value)}
            maxLength={MAX_CHU_TEN_CO}
            placeholder={T('Tên cô giáo hiện trên Zalo')}
            className={`${oNhap} w-full`}
          />
          <ChonCon value={themCon} onChange={setThemCon} busy={busy} cacCon={cacCon} />
          <div className="flex gap-2">
            <button
              onClick={() => setMoThem(false)}
              disabled={busy}
              className="rounded-card min-h-p-tap px-4 bg-surface-container-lowest text-on-surface
                         text-p-body-sm font-bold disabled:opacity-60"
            >
              {T('Thôi')}
            </button>
            <button
              onClick={them}
              disabled={busy || !themNhom.trim() || !themCo.trim() || themCon.length === 0}
              className="flex-1 rounded-card min-h-p-tap px-4 bg-primary text-on-primary text-p-body
                         font-bold disabled:opacity-40"
            >
              {T('Thêm nhóm')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setMoThem(true); setError(''); }}
          className="flex items-center justify-center gap-2 w-full rounded-card min-h-p-tap
                     bg-surface-container-lowest text-primary text-p-body font-bold card-shadow mb-4"
        >
          <span className="material-symbols-outlined">add</span>
          {T('Thêm nhóm Zalo')}
        </button>
      )}

      {error && (
        <p className="text-p-body text-error bg-error-container rounded-card p-3 mt-2">{error}</p>
      )}
    </>
  );
}
