'use client';

import { useState } from 'react';
import {
  docChildIds, ICON_NHIEM_VU_GOI_Y, ICON_NHIEM_VU_MAC_DINH, MAX_CHU_VIEC_NHA, MAX_SAO_NHIEM_VU,
  NHOM_NHIEM_VU, NHOM_NHIEM_VU_MAC_DINH, SAO_NHIEM_VU_MAC_DINH,
  type Child, type DailyChore, type NhomNhiemVu,
} from '@/lib/types';
import { useT } from '@/lib/i18n/client';

/** Hang chip chon nhom — dung cho ca the dang co va o them moi. */
function ChonNhom({ value, onChange, busy }: { value: NhomNhiemVu; onChange: (n: NhomNhiemVu) => void; busy: boolean }) {
  const T = useT();
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={T('Nhóm')}>
      {(Object.keys(NHOM_NHIEM_VU) as NhomNhiemVu[]).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          disabled={busy}
          onClick={() => onChange(n)}
          className={`min-h-9 px-3 rounded-full text-p-body-sm font-bold border disabled:opacity-60
                      ${value === n
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant'}`}
        >
          {NHOM_NHIEM_VU[n].icon} {T(NHOM_NHIEM_VU[n].label)}
        </button>
      ))}
    </div>
  );
}

/**
 * Hang chip "Giao cho": Cả nhà + tung con (avatar tron nho + ten).
 *
 * Mang RONG (`[]`) la mot trang thai that trong DB: xoa con cuoi cung duoc giao
 * mot nhiem vu thi deleteChild go id do ra, con lai mang rong (xem lib/store.ts).
 * Luc do khong chip nao sang va nhiem vu khong sinh dong cho ai — phai noi ro,
 * khong thi bo me chi thay mot the "Đang bật" im lang.
 */
function GiaoCho({ value, onChange, busy, cacCon }: {
  value: string[] | null; onChange: (v: string[] | null) => void; busy: boolean; cacCon: Child[];
}) {
  const T = useT();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-p-body-sm text-on-surface-variant mr-0.5">{T('Giao cho:')}</span>
      <button
        type="button"
        aria-pressed={value === null}
        disabled={busy}
        onClick={() => onChange(null)}
        className={`min-h-9 px-3 rounded-full text-p-body-sm font-bold border disabled:opacity-60
                    ${value === null
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant'}`}
      >
        {T('Cả nhà')}
      </button>
      {cacCon.map((ch) => {
        const chon = value !== null && value.includes(ch.id);
        const sauKhiBam = docChildIds(value, ch.id);
        return (
          <button
            key={ch.id}
            type="button"
            aria-pressed={chon}
            disabled={busy}
            onClick={() => {
              if (sauKhiBam !== value) onChange(sauKhiBam);
            }}
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
      {chuaGiaoAi(value) && (
        <p className="w-full text-p-body-sm text-error font-bold">
          {T('Chưa giao cho ai — chọn "Cả nhà" hoặc một con')}
        </p>
      )}
    </div>
  );
}

/** Nhiem vu dang bat nhung khong giao cho ai: co bat cung khong con nao thay. */
function chuaGiaoAi(childIds: string[] | null): boolean {
  return childIds !== null && childIds.length === 0;
}

/**
 * Danh sach "Nhiem vu hang ngay" — trang rieng cua bo me (issue #42, Q8), dung
 * khuon PhanThuong.tsx (Thuong > Danh sach phan thuong): MOT danh sach chung ca
 * nha, sua tai cho, giu state o day (khong router.refresh sau moi lan bam) vi bo
 * me hay bam lien tay.
 *
 * Moi nhiem vu (Q7): icon (mot emoji) + ten + so ⭐ (1..10) + NHOM (hai lua chon,
 * Q1) + "Giao cho" (chip "Cả nhà" = childIds null, hoac bam chon tung con) +
 * hai nut mui ten doi thu tu (nhu ViecNha.tsx cu, da xoa — keo tha tren dien
 * thoai de truot nham) + cong tac bat/tat + nut xoa (hoi lai mot nhip).
 *
 * Moi thay doi CHI anh huong dong tao SAU do (dong cua hom nay da tao giu
 * ten/icon/sao cu, sao da cong giu nguyen) — tru NHOM: doc live, doi la dong hom
 * nay doi cho theo (xem lib/store.ts). Xoa la danh dau bo, khong xoa dong that
 * (lich su tick va sao da cong con nguyen).
 */
export default function NhiemVuHangNgay({
  initial,
  cacCon,
}: {
  initial: DailyChore[];
  /** Cac con cua nha — de ve hang chip "Giao cho". */
  cacCon: Child[];
}) {
  const T = useT();
  const [chores, setChores] = useState(initial);
  const [hoiXoa, setHoiXoa] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* ---- Them moi ---- */
  const [themTen, setThemTen] = useState('');
  const [themIcon, setThemIcon] = useState(ICON_NHIEM_VU_MAC_DINH);
  const [themSao, setThemSao] = useState(String(SAO_NHIEM_VU_MAC_DINH));
  const [themNhom, setThemNhom] = useState<NhomNhiemVu>(NHOM_NHIEM_VU_MAC_DINH);
  const [themChildIds, setThemChildIds] = useState<string[] | null>(null);

  /** Goi API, nem loi tieng Viet de cho nao goi cung hien duoc len mot cho. */
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
    if (busy) return;
    const content = themTen.trim();
    const stars = Number(themSao);
    if (!content || !(stars >= 1 && stars <= MAX_SAO_NHIEM_VU)) return;
    const data = await goi('/api/viec-nha', {
      method: 'POST',
      body: JSON.stringify({ content, icon: themIcon, stars, nhom: themNhom, childIds: themChildIds }),
    });
    if (!data) return;
    setChores([...chores, data.chore]);
    setThemTen('');
    setThemIcon(ICON_NHIEM_VU_MAC_DINH);
    setThemSao(String(SAO_NHIEM_VU_MAC_DINH));
    // Giu nhom va "giao cho" vua chon: bo me hay them lien mot loat nhiem vu
    // cung nhom cho cung mot con.
  }

  async function sua(
    c: DailyChore,
    patch: Partial<Pick<DailyChore, 'content' | 'icon' | 'stars' | 'nhom' | 'childIds' | 'enabled'>>
  ) {
    const data = await goi(`/api/viec-nha/${c.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    if (data) setChores((ds) => ds.map((x) => (x.id === c.id ? data.chore : x)));
  }

  async function chuyen(c: DailyChore, move: 'len' | 'xuong') {
    const data = await goi(`/api/viec-nha/${c.id}`, { method: 'PATCH', body: JSON.stringify({ move }) });
    if (data) setChores(data.chores);
  }

  async function xoa(c: DailyChore) {
    const data = await goi(`/api/viec-nha/${c.id}`, { method: 'DELETE' });
    if (!data) return;
    setChores((ds) => ds.filter((x) => x.id !== c.id));
    setHoiXoa(null);
  }

  const oNhap =
    'rounded-lg border border-outline-variant min-h-p-tap px-3 text-p-body bg-surface-container-lowest';
  const oNut =
    'min-h-p-tap w-11 flex items-center justify-center rounded-lg text-on-surface-variant disabled:opacity-40';

  return (
    <>
      <div className="flex flex-col gap-p-tight mb-3">
        {chores.map((c, i) =>
          hoiXoa === c.id ? (
            <div key={c.id} className="bg-error-container rounded-card p-3">
              <p className="text-p-body text-on-error-container font-bold mb-0.5">
                {T('Xoá nhiệm vụ “{name}”?', { name: `${c.icon} ${c.content}` })}
              </p>
              <p className="text-p-body-sm text-on-error-container mb-3">
                {T('Nhiệm vụ này biến mất khỏi đây và không được thêm vào những ngày app tạo sau đó nữa — không lấy lại được. Những ngày đã tạo vẫn giữ nguyên, kể cả những lần các con đã tick và ⭐ đã cộng. Chỉ muốn tạm dừng thì tắt công tắc: app thôi tạo việc này cho những ngày chưa tạo, còn ngày đã tạo rồi thì con vẫn thấy và vẫn tick được — hôm nay, và cả ngày mai nếu bố mẹ đã giao bài cho ngày mai.')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setHoiXoa(null)}
                  disabled={busy}
                  className="flex-1 rounded-card min-h-p-tap bg-surface-container-lowest text-on-surface
                             text-p-body-sm font-bold disabled:opacity-60"
                >
                  {T('Thôi, giữ lại')}
                </button>
                <button
                  onClick={() => xoa(c)}
                  disabled={busy}
                  className="flex-1 rounded-card min-h-p-tap bg-error text-white text-p-body-sm font-bold
                             disabled:opacity-60"
                >
                  {T('Xoá nhiệm vụ này')}
                </button>
              </div>
            </div>
          ) : (
            <div
              key={c.id}
              className={`bg-surface-container-lowest rounded-card card-shadow p-2 flex flex-col gap-2
                          ${chuaGiaoAi(c.childIds) ? 'opacity-70' : ''}`}
            >
              {/* Hang 1: icon + ten + so sao */}
              <div className="flex gap-1.5">
                <input
                  defaultValue={c.icon}
                  key={`${c.id}:icon:${c.icon}`}
                  aria-label={T('Icon')}
                  onBlur={(e) => {
                    const moi = e.target.value.trim();
                    if (!moi || moi === c.icon) { e.target.value = c.icon; return; }
                    sua(c, { icon: moi });
                  }}
                  className={`${oNhap} w-14 text-center text-2xl px-0 shrink-0`}
                />
                <input
                  defaultValue={c.content}
                  key={`${c.id}:content:${c.content}`}
                  maxLength={MAX_CHU_VIEC_NHA}
                  aria-label={T('Tên nhiệm vụ')}
                  onBlur={(e) => {
                    // Xoa trang roi bam ra ngoai thi tra lai chu cu ngay tren the
                    // input (key khong doi nen React giu the, defaultValue bi bo qua)
                    const moi = e.target.value.trim();
                    if (!moi || moi === c.content) { e.target.value = c.content; return; }
                    sua(c, { content: moi });
                  }}
                  className={`${oNhap} flex-1 min-w-0 ${
                    c.enabled && !chuaGiaoAi(c.childIds) ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}
                />
                <label className="flex items-center gap-1 shrink-0">
                  <input
                    defaultValue={c.stars}
                    key={`${c.id}:stars:${c.stars}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_SAO_NHIEM_VU}
                    aria-label={T('Số sao')}
                    onBlur={(e) => {
                      const moi = Number(e.target.value);
                      if (!(moi >= 1 && moi <= MAX_SAO_NHIEM_VU) || moi === c.stars) {
                        e.target.value = String(c.stars);
                        return;
                      }
                      sua(c, { stars: moi });
                    }}
                    className={`${oNhap} w-16 text-right`}
                  />
                  <span className="text-p-body">⭐</span>
                </label>
              </div>

              {/* Hang 2: nhom */}
              <ChonNhom value={c.nhom} onChange={(nhom) => sua(c, { nhom })} busy={busy} />

              {/* Hang 3: giao cho */}
              <GiaoCho value={c.childIds} onChange={(childIds) => sua(c, { childIds })} busy={busy} cacCon={cacCon} />

              {/* Hang 4: thu tu + bat/tat + xoa */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => chuyen(c, 'len')}
                  disabled={busy || i === 0}
                  aria-label={T('Đưa "{name}" lên trên', { name: c.content })}
                  className={oNut}
                >
                  <span className="material-symbols-outlined">arrow_upward</span>
                </button>
                <button
                  onClick={() => chuyen(c, 'xuong')}
                  disabled={busy || i === chores.length - 1}
                  aria-label={T('Đưa "{name}" xuống dưới', { name: c.content })}
                  className={oNut}
                >
                  <span className="material-symbols-outlined">arrow_downward</span>
                </button>

                <button
                  onClick={() => sua(c, { enabled: !c.enabled })}
                  disabled={busy}
                  role="switch"
                  aria-checked={c.enabled}
                  className="flex-1 min-h-p-tap flex items-center justify-end gap-2 px-2 disabled:opacity-60"
                >
                  <span className="text-p-body-sm text-on-surface-variant">
                    {c.enabled ? T('Đang bật') : T('Đang tắt')}
                  </span>
                  <span
                    className={`w-11 h-6 rounded-full flex items-center shrink-0 transition-colors
                                ${c.enabled ? 'bg-primary' : 'bg-surface-container-high'}`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-surface-container-lowest card-shadow transition-transform
                                  ${c.enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'}`}
                    />
                  </span>
                </button>

                <button
                  onClick={() => { setHoiXoa(c.id); setError(''); }}
                  disabled={busy}
                  aria-label={T('Xoá "{name}"', { name: c.content })}
                  className={`${oNut} hover:text-error`}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          )
        )}

        {chores.length === 0 && (
          <p className="text-p-body-sm text-on-surface-variant py-2">
            {T('Chưa có nhiệm vụ nào. Thêm một việc thì các con sẽ thấy nó mỗi ngày trên màn của mình.')}
          </p>
        )}
      </div>

      {/* Them moi: hang icon goi y + icon + ten + sao, nhom, giao cho, nut Them */}
      <div className="bg-surface-container-low rounded-card p-3 flex flex-col gap-2 mb-4">
        <div className="flex flex-wrap gap-1">
          {ICON_NHIEM_VU_GOI_Y.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setThemIcon(ic)}
              aria-label={T('Chọn icon {icon}', { icon: ic })}
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
            aria-label={T('Icon nhiệm vụ mới')}
            className={`${oNhap} w-14 text-center text-2xl px-0 shrink-0`}
          />
          <input
            value={themTen}
            onChange={(e) => setThemTen(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') them(); }}
            maxLength={MAX_CHU_VIEC_NHA}
            placeholder={T('Thêm nhiệm vụ mới…')}
            className={`${oNhap} flex-1 min-w-0`}
          />
          <label className="flex items-center gap-1 shrink-0">
            <input
              value={themSao}
              onChange={(e) => setThemSao(e.target.value.replace(/\D/g, '').slice(0, 2))}
              onKeyDown={(e) => { if (e.key === 'Enter') them(); }}
              inputMode="numeric"
              aria-label={T('Số sao')}
              className={`${oNhap} w-16 text-right`}
            />
            <span className="text-p-body">⭐</span>
          </label>
        </div>
        <ChonNhom value={themNhom} onChange={setThemNhom} busy={busy} />
        <GiaoCho value={themChildIds} onChange={setThemChildIds} busy={busy} cacCon={cacCon} />
        <button
          onClick={them}
          disabled={busy || themTen.trim() === '' || !(Number(themSao) >= 1 && Number(themSao) <= MAX_SAO_NHIEM_VU)}
          className="rounded-card min-h-p-tap px-4 bg-primary text-on-primary text-p-body font-bold
                     disabled:opacity-40"
        >
          {T('Thêm nhiệm vụ')}
        </button>
      </div>

      {error && (
        <p className="text-p-body text-error bg-error-container rounded-card p-3 mt-2">{error}</p>
      )}
    </>
  );
}
