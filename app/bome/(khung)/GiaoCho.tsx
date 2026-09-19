'use client';

import type { Child } from '@/lib/types';
import { docChildIds } from '@/lib/types';
import { useT } from '@/lib/i18n/client';

/**
 * Hang chip "Giao cho": Cả nhà + tung con (avatar tron nho + ten). Dung chung
 * cho hai man cai dat cua bo me co cau hinh "cua con nao": nhiem vu hang ngay
 * (/bome/nhiem-vu-hang-ngay, issue #42) va sach cua nha (/bome/sach, issue #64)
 * — hai bang deu dung mot cot child_ids cung y nghia (null = ca nha).
 *
 * Mang RONG (`[]`) la mot trang thai that trong DB: xoa con cuoi cung duoc giao
 * mot nhiem vu / mot cuon sach thi deleteChild go id do ra, con lai mang rong
 * (xem lib/store.ts). Luc do khong chip nao sang va cau hinh do khong ap cho ai —
 * phai noi ro, khong thi bo me chi thay mot the im lang.
 *
 * `nhan` la chu dau hang ("Giao cho:" / "Sách của:") — khoa dich, noi goi truyen
 * ban da dich.
 */
export default function GiaoCho({ value, onChange, busy, cacCon, nhan }: {
  value: string[] | null; onChange: (v: string[] | null) => void; busy: boolean; cacCon: Child[];
  nhan: string;
}) {
  const T = useT();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-p-body-sm text-on-surface-variant mr-0.5">{nhan}</span>
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

/** Cau hinh dang bat nhung khong giao cho ai: co bat cung khong con nao thay. */
export function chuaGiaoAi(childIds: string[] | null): boolean {
  return childIds !== null && childIds.length === 0;
}
