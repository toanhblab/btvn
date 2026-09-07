'use client';

import { useState } from 'react';
import {
  ICON_PHAN_THUONG_GOI_Y, ICON_PHAN_THUONG_MAC_DINH, MAX_CHU_PHAN_THUONG, MAX_GIA_PHAN_THUONG,
  type Reward,
} from '@/lib/types';

/**
 * Danh sach phan thuong o man Thuong cua bo me — cung khuon voi ViecNha.tsx
 * (Cai dat > Nhiem vu moi ngay): MOT danh sach chung ca nha, sua tai cho, giu
 * state o day (khong router.refresh sau moi lan bam) vi bo me hay bam lien tay.
 *
 * Moi phan thuong: icon (mot emoji, chon nhanh tu hang goi y hoac go), ten, gia
 * ⭐, cong tac bat/tat, nut xoa (hoi lai mot nhip). Khong co nut doi thu tu:
 * cua hang cua con sap theo gia tang dan (listRewards), thu re truoc.
 */
export default function PhanThuong({ initial }: { initial: Reward[] }) {
  const [rewards, setRewards] = useState(initial);
  const [themTen, setThemTen] = useState('');
  const [themGia, setThemGia] = useState('');
  const [themIcon, setThemIcon] = useState(ICON_PHAN_THUONG_MAC_DINH);
  const [hoiXoa, setHoiXoa] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /** Goi API, nem loi tieng Viet de cho nao goi cung hien duoc len mot cho. */
  async function goi(url: string, init: RequestInit) {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Không lưu được');
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được. Thử lại nhé.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function them() {
    if (busy) return;
    const name = themTen.trim();
    const cost = Number(themGia);
    if (!name || !(cost > 0)) return;
    const data = await goi('/api/phan-thuong', {
      method: 'POST',
      body: JSON.stringify({ name, cost, icon: themIcon }),
    });
    if (!data) return;
    setRewards([...rewards, data.reward].sort((a, b) => a.cost - b.cost));
    setThemTen('');
    setThemGia('');
    setThemIcon(ICON_PHAN_THUONG_MAC_DINH);
  }

  async function sua(r: Reward, patch: Partial<Pick<Reward, 'name' | 'icon' | 'cost' | 'enabled'>>) {
    const data = await goi(`/api/phan-thuong/${r.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    if (data) {
      setRewards((ds) => ds.map((x) => (x.id === r.id ? data.reward : x)).sort((a, b) => a.cost - b.cost));
    }
  }

  async function xoa(r: Reward) {
    const data = await goi(`/api/phan-thuong/${r.id}`, { method: 'DELETE' });
    if (!data) return;
    setRewards((ds) => ds.filter((x) => x.id !== r.id));
    setHoiXoa(null);
  }

  const oNhap =
    'rounded-lg border border-outline-variant min-h-p-tap px-3 text-p-body bg-surface-container-lowest';
  const oNut =
    'min-h-p-tap w-11 flex items-center justify-center rounded-lg text-on-surface-variant disabled:opacity-40';

  return (
    <>
      <p className="text-p-body-sm text-on-surface-variant mb-2">
        Cả nhà dùng chung một danh sách. Con đủ ⭐ thì xin đổi, bố mẹ duyệt ở trên. Sửa giá
        không đổi những yêu cầu đang chờ.
      </p>

      <div className="flex flex-col gap-p-tight mb-3">
        {rewards.map((r) =>
          hoiXoa === r.id ? (
            <div key={r.id} className="bg-error-container rounded-card p-3">
              <p className="text-p-body text-on-error-container font-bold mb-0.5">
                Xoá “{r.icon} {r.name}”?
              </p>
              <p className="text-p-body-sm text-on-error-container mb-3">
                Con không thấy nó ở cửa hàng nữa. Yêu cầu đang chờ và lịch sử đã đổi vẫn giữ
                nguyên. Chỉ muốn tạm ẩn thì tắt công tắc là được.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setHoiXoa(null)}
                  disabled={busy}
                  className="flex-1 rounded-card min-h-p-tap bg-surface-container-lowest text-on-surface
                             text-p-body-sm font-bold disabled:opacity-60"
                >
                  Thôi, giữ lại
                </button>
                <button
                  onClick={() => xoa(r)}
                  disabled={busy}
                  className="flex-1 rounded-card min-h-p-tap bg-error text-white text-p-body-sm font-bold
                             disabled:opacity-60"
                >
                  Xoá
                </button>
              </div>
            </div>
          ) : (
            <div
              key={r.id}
              className="bg-surface-container-lowest rounded-card card-shadow p-2 flex flex-col gap-1.5"
            >
              <div className="flex gap-1.5">
                <input
                  defaultValue={r.icon}
                  key={`${r.id}:icon:${r.icon}`}
                  aria-label="Icon"
                  onBlur={(e) => {
                    const moi = e.target.value.trim();
                    if (!moi || moi === r.icon) { e.target.value = r.icon; return; }
                    sua(r, { icon: moi });
                  }}
                  className={`${oNhap} w-14 text-center text-2xl px-0 shrink-0`}
                />
                <input
                  defaultValue={r.name}
                  key={`${r.id}:name:${r.name}`}
                  maxLength={MAX_CHU_PHAN_THUONG}
                  aria-label="Tên phần thưởng"
                  onBlur={(e) => {
                    // Xoa trang roi bam ra ngoai thi tra lai chu cu ngay tren the
                    // input (key khong doi nen React giu the, defaultValue bi bo qua)
                    const moi = e.target.value.trim();
                    if (!moi || moi === r.name) { e.target.value = r.name; return; }
                    sua(r, { name: moi });
                  }}
                  className={`${oNhap} flex-1 min-w-0 ${r.enabled ? 'text-on-surface' : 'text-on-surface-variant'}`}
                />
                <label className="flex items-center gap-1 shrink-0">
                  <input
                    defaultValue={r.cost}
                    key={`${r.id}:cost:${r.cost}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_GIA_PHAN_THUONG}
                    aria-label="Giá (điểm)"
                    onBlur={(e) => {
                      const moi = Number(e.target.value);
                      if (!(moi > 0) || moi === r.cost) { e.target.value = String(r.cost); return; }
                      sua(r, { cost: moi });
                    }}
                    className={`${oNhap} w-20 text-right`}
                  />
                  <span className="text-p-body">⭐</span>
                </label>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => sua(r, { enabled: !r.enabled })}
                  disabled={busy}
                  role="switch"
                  aria-checked={r.enabled}
                  className="flex-1 min-h-p-tap flex items-center justify-end gap-2 px-2 disabled:opacity-60"
                >
                  <span className="text-p-body-sm text-on-surface-variant">
                    {r.enabled ? 'Đang bật' : 'Đang tắt'}
                  </span>
                  <span
                    className={`w-11 h-6 rounded-full flex items-center shrink-0 transition-colors
                                ${r.enabled ? 'bg-primary' : 'bg-surface-container-high'}`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-surface-container-lowest card-shadow transition-transform
                                  ${r.enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'}`}
                    />
                  </span>
                </button>
                <button
                  onClick={() => { setHoiXoa(r.id); setError(''); }}
                  disabled={busy}
                  aria-label={`Xoá "${r.name}"`}
                  className={`${oNut} hover:text-error`}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          )
        )}

        {rewards.length === 0 && (
          <p className="text-p-body-sm text-on-surface-variant py-2">
            Chưa có phần thưởng nào. Thêm vài cái các con thích — ví dụ “Ăn kem” 30 ⭐, “Xem
            phim tối thứ Bảy” 50 ⭐ — thì cửa hàng của con mới có gì để đổi.
          </p>
        )}
      </div>

      {/* Them moi: hang icon goi y + ten + gia + nut Them */}
      <div className="bg-surface-container-low rounded-card p-3 flex flex-col gap-2 mb-4">
        <div className="flex flex-wrap gap-1">
          {ICON_PHAN_THUONG_GOI_Y.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setThemIcon(ic)}
              aria-label={`Chọn icon ${ic}`}
              aria-pressed={themIcon === ic}
              className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center
                          ${themIcon === ic ? 'bg-primary-fixed ring-2 ring-primary' : 'bg-surface-container-lowest'}`}
            >
              {ic}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={themIcon}
            onChange={(e) => setThemIcon(e.target.value)}
            aria-label="Icon phần thưởng mới"
            className={`${oNhap} w-14 text-center text-2xl px-0 shrink-0`}
          />
          <input
            value={themTen}
            onChange={(e) => setThemTen(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') them(); }}
            maxLength={MAX_CHU_PHAN_THUONG}
            placeholder="Tên phần thưởng…"
            className={`${oNhap} flex-1 min-w-0`}
          />
          <input
            value={themGia}
            onChange={(e) => setThemGia(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => { if (e.key === 'Enter') them(); }}
            inputMode="numeric"
            placeholder="⭐"
            aria-label="Giá (điểm)"
            className={`${oNhap} w-20 text-right`}
          />
        </div>
        <button
          onClick={them}
          disabled={busy || themTen.trim() === '' || !(Number(themGia) > 0)}
          className="rounded-card min-h-p-tap px-4 bg-primary text-on-primary text-p-body font-bold
                     disabled:opacity-40"
        >
          Thêm phần thưởng
        </button>
      </div>

      {error && (
        <p className="text-p-body text-error bg-error-container rounded-card p-3 mt-2">{error}</p>
      )}
    </>
  );
}
