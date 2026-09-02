'use client';

import { useState } from 'react';
import { MAX_CHU_VIEC_NHA, type DailyChore } from '@/lib/types';

/**
 * Danh sach "Nhiem vu moi ngay" o man Cai dat cua bo me.
 *
 * MOT danh sach chung ca nha (issue #25): sua mot lan la ca ba con deu thay o man
 * khen sau khi lam xong bai cuoi cung cua hom nay.
 *
 * Doi thu tu bang HAI NUT MUI TEN chu khong keo tha: bo me hay mo man nay tren
 * dien thoai, keo tha bang ngon cai tren danh sach ngan la de truot nham hon la
 * bam. Ban dung thu co ve tay cam keo tha, nhung captain chot lay duong thang.
 *
 * Trang thai giu ngay tai day (khong router.refresh sau moi lan bam): moi thao
 * tac sua dung mot dong, va bo me hay bam lien tay — refresh ca trang giua chung
 * thi o dang go bi nhay.
 */
export default function ViecNha({ initial }: { initial: DailyChore[] }) {
  const [chores, setChores] = useState(initial);
  const [them, setThem] = useState('');
  const [hoiXoa, setHoiXoa] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /** Goi API, nem loi tieng Viet de cho nao goi cung hien duoc len mot cho. */
  async function goi(url: string, init: RequestInit) {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
      });
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

  async function themViec() {
    if (busy) return;
    const content = them.trim();
    if (!content) return;
    const data = await goi('/api/viec-nha', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    if (!data) return;
    setChores([...chores, data.chore]);
    setThem('');
  }

  /** Luu chu khi roi o nhap — chi goi khi that su co doi. */
  async function luuChu(c: DailyChore, content: string) {
    const moi = content.trim();
    if (!moi || moi === c.content) return;
    const data = await goi(`/api/viec-nha/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: moi }),
    });
    if (data) setChores((ds) => ds.map((x) => (x.id === c.id ? data.chore : x)));
  }

  async function batTat(c: DailyChore) {
    const data = await goi(`/api/viec-nha/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !c.enabled }),
    });
    if (data) setChores((ds) => ds.map((x) => (x.id === c.id ? data.chore : x)));
  }

  async function chuyen(c: DailyChore, move: 'len' | 'xuong') {
    const data = await goi(`/api/viec-nha/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ move }),
    });
    if (data) setChores(data.chores);
  }

  async function xoa(c: DailyChore) {
    const data = await goi(`/api/viec-nha/${c.id}`, { method: 'DELETE' });
    if (!data) return;
    setChores((ds) => ds.filter((x) => x.id !== c.id));
    setHoiXoa(null);
  }

  const oNut =
    'min-h-p-tap w-11 flex items-center justify-center rounded-lg text-on-surface-variant ' +
    'disabled:opacity-40';

  return (
    <>
      <p className="text-p-body-sm text-on-surface-variant mb-2 xl:mb-4">
        Làm xong bài cuối cùng của ngày, các con sẽ thấy danh sách này ở màn khen
        và tự tick từng việc. Cả nhà dùng chung một danh sách.
      </p>

      <div className="flex flex-col gap-p-tight mb-3">
        {chores.map((c, i) =>
          hoiXoa === c.id ? (
            <div key={c.id} className="bg-error-container rounded-card p-3">
              <p className="text-p-body text-on-error-container font-bold mb-0.5">
                Xoá việc “{c.content}”?
              </p>
              <p className="text-p-body-sm text-on-error-container mb-3">
                Những lần các con đã tick việc này cũng mất theo. Chỉ muốn tạm ẩn
                thì tắt công tắc là được.
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
                  onClick={() => xoa(c)}
                  disabled={busy}
                  className="flex-1 rounded-card min-h-p-tap bg-error text-white
                             text-p-body-sm font-bold disabled:opacity-60"
                >
                  Xoá việc này
                </button>
              </div>
            </div>
          ) : (
            <div
              key={c.id}
              className="bg-surface-container-lowest rounded-card card-shadow p-2 flex flex-col gap-1.5
                         xl:shadow-none xl:border xl:border-outline-variant/40 xl:p-3"
            >
              <input
                defaultValue={c.content}
                key={`${c.id}:${c.content}`}
                maxLength={MAX_CHU_VIEC_NHA}
                onBlur={(e) => {
                  // Xoa trang o nhap roi bam ra ngoai thi tra lai chu cu NGAY tren
                  // the input: doi state khong lam <input> ve lai duoc (key khong
                  // doi nen React giu nguyen the, defaultValue bi bo qua), bo me se
                  // nhin thay o trong trong khi DB con chu cu.
                  const moi = e.target.value.trim();
                  if (!moi || moi === c.content) {
                    e.target.value = c.content;
                    return;
                  }
                  luuChu(c, moi);
                }}
                aria-label="Nội dung việc"
                className={`w-full rounded-lg border border-outline-variant min-h-p-tap px-3 text-p-body
                            bg-surface-container-lowest ${c.enabled ? 'text-on-surface' : 'text-on-surface-variant'}`}
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => chuyen(c, 'len')}
                  disabled={busy || i === 0}
                  aria-label={`Đưa "${c.content}" lên trên`}
                  className={oNut}
                >
                  <span className="material-symbols-outlined">arrow_upward</span>
                </button>
                <button
                  onClick={() => chuyen(c, 'xuong')}
                  disabled={busy || i === chores.length - 1}
                  aria-label={`Đưa "${c.content}" xuống dưới`}
                  className={oNut}
                >
                  <span className="material-symbols-outlined">arrow_downward</span>
                </button>

                <button
                  onClick={() => batTat(c)}
                  disabled={busy}
                  role="switch"
                  aria-checked={c.enabled}
                  className="flex-1 min-h-p-tap flex items-center justify-end gap-2 px-2 disabled:opacity-60"
                >
                  <span className="text-p-body-sm text-on-surface-variant">
                    {c.enabled ? 'Đang bật' : 'Đang tắt'}
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
                  aria-label={`Xoá "${c.content}"`}
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
            Chưa có việc nào. Thêm một việc thì các con sẽ được nhắc.
          </p>
        )}
      </div>

      <div className="flex gap-2 mb-4 xl:mb-0">
        <input
          value={them}
          onChange={(e) => setThem(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') themViec(); }}
          maxLength={MAX_CHU_VIEC_NHA}
          placeholder="Thêm việc mới…"
          className="flex-1 min-w-0 rounded-lg border border-outline-variant min-h-p-tap px-3 text-p-body
                     bg-surface-container-lowest"
        />
        <button
          onClick={themViec}
          disabled={busy || them.trim() === ''}
          className="rounded-card min-h-p-tap px-4 bg-primary text-on-primary text-p-body font-bold
                     disabled:opacity-40 shrink-0"
        >
          Thêm
        </button>
      </div>

      {error && (
        <p className="text-p-body text-error bg-error-container rounded-card p-3 mt-2">{error}</p>
      )}
    </>
  );
}
