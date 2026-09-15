'use client';

import { useState } from 'react';
import { MAX_CHU_TEN_SACH, SUBJECTS, type Book, type Child, type TenMon } from '@/lib/types';
import { useT } from '@/lib/i18n/client';
import GiaoCho, { chuaGiaoAi } from '../GiaoCho';

/**
 * O chon mon cua mot cuon sach. Gia tri la KHOA (ten mon tieng Viet trong
 * SUBJECTS) — luu vao DB va dua vao loi nhac AI; chu hien ra la T(khoa). Chuoi
 * rong = chua ro mon (null).
 */
function ChonMon({ value, onChange, busy }: {
  value: TenMon | null; onChange: (m: TenMon | null) => void; busy: boolean;
}) {
  const T = useT();
  return (
    <select
      value={value ?? ''}
      disabled={busy}
      onChange={(e) => onChange((e.target.value || null) as TenMon | null)}
      aria-label={T('Môn của sách')}
      className="text-p-body-sm rounded-full bg-surface-container px-3 py-1.5 text-on-surface min-h-9 disabled:opacity-60"
    >
      <option value="">{T('Chưa rõ môn')}</option>
      {(Object.keys(SUBJECTS) as TenMon[]).map((m) => (
        <option key={m} value={m}>{SUBJECTS[m]} {T(m)}</option>
      ))}
    </select>
  );
}

/**
 * Danh sach "Sach cua cac con" — trang rieng cua bo me (issue #64), dung khuon
 * NhiemVuHangNgay.tsx: MOT danh sach cua nha, sua tai cho, giu state o day
 * (khong router.refresh sau moi lan bam) vi bo me hay bam lien tay.
 *
 * Moi cuon: ten + mon (tuy chon) + "Sach cua" (chip "Cả nhà" = childIds null,
 * hoac bam chon tung con) + nut bo (hoi lai mot nhip). Khong co icon / sao / thu
 * tu: danh sach nay la NGU CANH cho AI, khong ve len man cua con.
 *
 * Bo la danh dau, khong xoa dong that (migrations/021): bai da giao giu nguyen
 * ten sach trong ghi chu, chi tu lan tach sau may khong dung cuon do nua.
 */
export default function Sach({
  initial,
  cacCon,
}: {
  initial: Book[];
  /** Cac con cua nha — de ve hang chip "Sách của". */
  cacCon: Child[];
}) {
  const T = useT();
  const [books, setBooks] = useState(initial);
  const [hoiBo, setHoiBo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* ---- Them moi ---- */
  const [themTen, setThemTen] = useState('');
  const [themMon, setThemMon] = useState<TenMon | null>(null);
  const [themChildIds, setThemChildIds] = useState<string[] | null>(null);

  /** Goi API, nem loi de cho nao goi cung hien duoc len mot cho. */
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
    const name = themTen.trim();
    if (!name) return;
    const data = await goi('/api/sach', {
      method: 'POST',
      body: JSON.stringify({ name, subject: themMon, childIds: themChildIds }),
    });
    if (!data) return;
    setBooks([...books, data.book]);
    setThemTen('');
    // Giu mon va "sach cua" vua chon: bo me hay khai lien mot loat sach cung mon
    // cho cung mot con (Toán tập 1, Toán tập 2...).
  }

  async function sua(b: Book, patch: Partial<Pick<Book, 'name' | 'subject' | 'childIds'>>) {
    const data = await goi(`/api/sach/${b.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    if (data) setBooks((ds) => ds.map((x) => (x.id === b.id ? data.book : x)));
  }

  async function bo(b: Book) {
    const data = await goi(`/api/sach/${b.id}`, { method: 'DELETE' });
    if (!data) return;
    setBooks((ds) => ds.filter((x) => x.id !== b.id));
    setHoiBo(null);
  }

  const oNhap =
    'rounded-lg border border-outline-variant min-h-p-tap px-3 text-p-body bg-surface-container-lowest';
  const oNut =
    'min-h-p-tap w-11 flex items-center justify-center rounded-lg text-on-surface-variant disabled:opacity-40';

  return (
    <>
      <div className="flex flex-col gap-p-tight mb-3">
        {books.map((b) =>
          hoiBo === b.id ? (
            <div key={b.id} className="bg-error-container rounded-card p-3">
              <p className="text-p-body text-on-error-container font-bold mb-0.5">
                {T('Bỏ cuốn “{name}”?', { name: b.name })}
              </p>
              <p className="text-p-body-sm text-on-error-container mb-3">
                {T('Cuốn này biến mất khỏi danh sách và từ lần tách bài sau máy không dùng nó để nhận tên sách nữa. Bài đã giao vẫn giữ nguyên tên sách trong ghi chú.')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setHoiBo(null)}
                  disabled={busy}
                  className="flex-1 rounded-card min-h-p-tap bg-surface-container-lowest text-on-surface
                             text-p-body-sm font-bold disabled:opacity-60"
                >
                  {T('Thôi, giữ lại')}
                </button>
                <button
                  onClick={() => bo(b)}
                  disabled={busy}
                  className="flex-1 rounded-card min-h-p-tap bg-error text-white text-p-body-sm font-bold
                             disabled:opacity-60"
                >
                  {T('Bỏ cuốn này')}
                </button>
              </div>
            </div>
          ) : (
            <div
              key={b.id}
              className={`bg-surface-container-lowest rounded-card card-shadow p-2 flex flex-col gap-2
                          ${chuaGiaoAi(b.childIds) ? 'opacity-70' : ''}`}
            >
              {/* Hang 1: ten + bo. Mon xuong hang rieng: o 390px ten sach dai
                  ("Tiếng Việt tập 1") bi o chon mon ep mat chu. */}
              <div className="flex gap-1.5 items-center">
                <span className="material-symbols-outlined text-primary shrink-0" aria-hidden="true">menu_book</span>
                <input
                  defaultValue={b.name}
                  key={`${b.id}:name:${b.name}`}
                  maxLength={MAX_CHU_TEN_SACH}
                  aria-label={T('Tên sách')}
                  onBlur={(e) => {
                    // Xoa trang roi bam ra ngoai thi tra lai chu cu ngay tren the
                    // input (key khong doi nen React giu the, defaultValue bi bo qua)
                    const moi = e.target.value.trim();
                    if (!moi || moi === b.name) { e.target.value = b.name; return; }
                    sua(b, { name: moi });
                  }}
                  className={`${oNhap} flex-1 min-w-0 text-on-surface`}
                />
                <button
                  onClick={() => { setHoiBo(b.id); setError(''); }}
                  disabled={busy}
                  aria-label={T('Xoá "{name}"', { name: b.name })}
                  className={`${oNut} hover:text-error`}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>

              {/* Hang 2: mon */}
              <div className="flex items-center gap-1.5">
                <span className="text-p-body-sm text-on-surface-variant mr-0.5">{T('Môn:')}</span>
                <ChonMon value={b.subject} onChange={(subject) => sua(b, { subject })} busy={busy} />
              </div>

              {/* Hang 3: sach cua con nao */}
              <GiaoCho value={b.childIds} onChange={(childIds) => sua(b, { childIds })} busy={busy} cacCon={cacCon} nhan={T('Sách của:')} />
            </div>
          )
        )}

        {books.length === 0 && (
          <p className="text-p-body-sm text-on-surface-variant py-2">
            {T('Chưa có cuốn nào. Thêm sách, vở, phiếu bài tập các con đang dùng để máy tách bài chuẩn hơn.')}
          </p>
        )}
      </div>

      {/* Them moi: ten, mon, sach cua, nut Them */}
      <div className="bg-surface-container-low rounded-card p-3 flex flex-col gap-2 mb-4">
        <input
          value={themTen}
          onChange={(e) => setThemTen(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') them(); }}
          maxLength={MAX_CHU_TEN_SACH}
          placeholder={T('Tên sách, vở, phiếu bài tập…')}
          className={`${oNhap} w-full min-w-0`}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-p-body-sm text-on-surface-variant mr-0.5">{T('Môn:')}</span>
          <ChonMon value={themMon} onChange={setThemMon} busy={busy} />
        </div>
        <GiaoCho value={themChildIds} onChange={setThemChildIds} busy={busy} cacCon={cacCon} nhan={T('Sách của:')} />
        <button
          onClick={them}
          disabled={busy || themTen.trim() === ''}
          className="rounded-card min-h-p-tap px-4 bg-primary text-on-primary text-p-body font-bold
                     disabled:opacity-40"
        >
          {T('Thêm sách')}
        </button>
      </div>

      {error && (
        <p className="text-p-body text-error bg-error-container rounded-card p-3 mt-2">{error}</p>
      )}
    </>
  );
}
