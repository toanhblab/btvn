'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChildColor, Redemption } from '@/lib/types';

export interface YeuCauChoDuyet {
  redemption: Redemption;
  childName: string;
  childAvatar: string;
  childColor: ChildColor;
  /** Diem con dang co — de bo me thay con con du khong truoc khi duyet. */
  diem: number;
}

/**
 * Danh sach yeu cau doi thuong dang cho, moi cai hai nut: Duyet / Tu choi
 * (PATCH /api/doi-thuong/:id, CAN PIN).
 *
 * Duyet la tru diem that nen hoi lai mot nhip ("Duyet? / Thoi") — tu choi thi
 * khong hoi vi con khong mat gi, xin lai duoc. Xong thi bo dong do khoi danh
 * sach ngay va router.refresh() de "Da xu ly gan day" + so ⭐ tung con o trang
 * cha doc lai.
 */
export default function DuyetThuong({ initial }: { initial: YeuCauChoDuyet[] }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [hoi, setHoi] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const BAR: Record<ChildColor, string> = {
    primary: 'bg-primary',
    secondary: 'bg-secondary-container',
    tertiary: 'bg-tertiary-container',
  };

  async function quyetDinh(id: string, decision: 'approve' | 'reject') {
    setBusy(id);
    setError('');
    try {
      const res = await fetch(`/api/doi-thuong/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Không lưu được');
      setList((ds) => ds.filter((y) => y.redemption.id !== id));
      setHoi(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được. Thử lại nhé.');
    } finally {
      setBusy(null);
    }
  }

  if (list.length === 0) {
    return (
      <p className="bg-surface-container-lowest rounded-card card-shadow p-3 text-p-body-sm text-on-surface-variant">
        Chưa có yêu cầu nào. Con xin đổi thưởng ở màn của con thì hiện ở đây.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-p-tight">
      {list.map(({ redemption: r, childName, childAvatar, childColor, diem }) => {
        const duDiem = diem >= r.cost;
        const dangHoi = hoi === r.id;
        return (
          <div
            key={r.id}
            className="bg-surface-container-lowest rounded-card card-shadow relative overflow-hidden p-3 pl-4"
          >
            <div className={`absolute left-0 inset-y-0 w-1 ${BAR[childColor]}`} />
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={childAvatar} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-p-body text-on-surface">
                  <b>{childName}</b> xin đổi <b>{r.rewardName}</b>
                </span>
                <span className={`block text-p-body-sm ${duDiem ? 'text-on-surface-variant' : 'text-error'}`}>
                  Giá {r.cost} ⭐ · con đang có {diem} ⭐
                  {!duDiem && ' — chưa đủ'}
                </span>
              </span>
              <span className="text-3xl shrink-0">{r.rewardIcon}</span>
            </div>

            {dangHoi ? (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setHoi(null)}
                  disabled={busy !== null}
                  className="flex-1 rounded-card min-h-p-tap border-2 border-outline-variant
                             text-on-surface-variant text-p-body-sm font-bold disabled:opacity-60"
                >
                  Thôi
                </button>
                <button
                  onClick={() => quyetDinh(r.id, 'approve')}
                  disabled={busy !== null}
                  className="flex-1 rounded-card min-h-p-tap bg-success text-white text-p-body-sm font-bold
                             disabled:opacity-60"
                >
                  {busy === r.id ? 'Đang lưu…' : `Duyệt, trừ ${r.cost} ⭐`}
                </button>
              </div>
            ) : (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => quyetDinh(r.id, 'reject')}
                  disabled={busy !== null}
                  className="flex-1 rounded-card min-h-p-tap border-2 border-outline-variant
                             text-on-surface-variant text-p-body-sm font-bold disabled:opacity-60"
                >
                  Từ chối
                </button>
                <button
                  onClick={() => { setHoi(r.id); setError(''); }}
                  disabled={busy !== null || !duDiem}
                  className="flex-1 rounded-card min-h-p-tap bg-primary text-on-primary text-p-body-sm font-bold
                             disabled:opacity-40"
                >
                  Duyệt
                </button>
              </div>
            )}
          </div>
        );
      })}

      {error && (
        <p className="text-p-body text-error bg-error-container rounded-card p-3">{error}</p>
      )}
    </div>
  );
}
