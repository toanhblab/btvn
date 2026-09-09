'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChildColor, Redemption } from '@/lib/types';
import { useT } from '@/lib/i18n/client';

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
 *
 * router.refresh() chay ca khi may chu TU CHOI, truoc khi nem loi: cai lam duyet
 * that bai la so du that da khac so man nay dang hien ("Con chi con 2 diem, chua
 * du 5 diem" trong khi vien ⭐ va dong nay van ghi 10). Khong doc lai thi mot man
 * hien hai con so cho cung mot so du — cung bat bien voi TruDiem.tsx.
 *
 * `list` bo dong da xu ly NGAY (lac quan) nhung phai dong bo lai voi props
 * `initial` moi khi trang cha render lai: giua luc bo me mo trang, con o iPad
 * co the xin them — khong dong bo thi tieu de "Cho duyet (N)" cua trang cha
 * dem dung con danh sach nay van thieu yeu cau moi cho den khi tai lai trang.
 *
 * Dong bo phai LOC lai nhung id bo me vua quyet dinh tai may nay (`daQuyetDinh`):
 * bo me bam hai dong lien tay thi payload cua router.refresh() lan TRUOC duoc
 * render khi dong thu hai con 'pending', ve sau moi ve — ghi de thang thi dong
 * da duyet nhay lai duoi "Cho duyet" va bam tiep se an bao loi "da duoc xu ly
 * roi". Id nao may chu khong con liet ke nua thi bo khoi tap cho do rac.
 */
export default function DuyetThuong({ initial }: { initial: YeuCauChoDuyet[] }) {
  const T = useT();
  const router = useRouter();
  const daQuyetDinh = useRef<Set<string>>(new Set());
  const [list, setList] = useState(initial);
  useEffect(() => {
    const conCho = new Set(initial.map((y) => y.redemption.id));
    for (const id of daQuyetDinh.current) {
      if (!conCho.has(id)) daQuyetDinh.current.delete(id);
    }
    setList(initial.filter((y) => !daQuyetDinh.current.has(y.redemption.id)));
  }, [initial]);
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
      router.refresh();
      if (!res.ok) throw new Error(data.error ?? T('Không lưu được'));
      daQuyetDinh.current.add(id);
      setList((ds) => ds.filter((y) => y.redemption.id !== id));
      setHoi(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : T('Không lưu được. Thử lại nhé.'));
    } finally {
      setBusy(null);
    }
  }

  if (list.length === 0) {
    return (
      <p className="bg-surface-container-lowest rounded-card card-shadow p-3 text-p-body-sm text-on-surface-variant">
        {T('Chưa có yêu cầu nào. Con xin đổi thưởng ở màn của con thì hiện ở đây.')}
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
                  <b>{childName}</b> {T('xin đổi')} <b>{r.rewardName}</b>
                </span>
                <span className={`block text-p-body-sm ${duDiem ? 'text-on-surface-variant' : 'text-error'}`}>
                  {T('Giá {n} ⭐ · con đang có {diem} ⭐', { n: r.cost, diem })}
                  {!duDiem && ` — ${T('chưa đủ')}`}
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
                  {T('Thôi')}
                </button>
                <button
                  onClick={() => quyetDinh(r.id, 'approve')}
                  disabled={busy !== null}
                  className="flex-1 rounded-card min-h-p-tap bg-success text-white text-p-body-sm font-bold
                             disabled:opacity-60"
                >
                  {busy === r.id ? T('Đang lưu…') : T('Duyệt, trừ {n} ⭐', { n: r.cost })}
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
                  {T('Từ chối')}
                </button>
                <button
                  onClick={() => { setHoi(r.id); setError(''); }}
                  disabled={busy !== null || !duDiem}
                  className="flex-1 rounded-card min-h-p-tap bg-primary text-on-primary text-p-body-sm font-bold
                             disabled:opacity-40"
                >
                  {T('Duyệt')}
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
