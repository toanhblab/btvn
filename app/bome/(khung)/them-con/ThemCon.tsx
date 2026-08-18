'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Child, ChildColor } from '@/lib/types';
import { anhTam } from '@/lib/avatar';

const MAU: { value: ChildColor; ten: string; swatch: string }[] = [
  { value: 'primary',   ten: 'Xanh', swatch: 'bg-primary' },
  { value: 'secondary', ten: 'Cam',  swatch: 'bg-secondary-container' },
  { value: 'tertiary',  ten: 'Vàng', swatch: 'bg-tertiary-fixed-dim' },
];

/**
 * Them mot con — cung bo truong voi man "Sua ho so".
 *
 * @param others   Cac con da co, de goi mau chua ai dung va canh bao khi trung.
 * @param dauTien  Nha con trong: doi loi chao va bo nut "Huy" (chua co gi de ve).
 */
export default function ThemCon({ others, dauTien }: { others: Child[]; dauTien: boolean }) {
  const router = useRouter();

  // Goi san mau chua con nao dung: hai con trung mau la mat cach tu nhan ra minh
  const conTrong = MAU.find((m) => !others.some((c) => c.color === m.value)) ?? MAU[0];

  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [color, setColor] = useState<ChildColor>(conTrong.value);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const trungMau = others.find((c) => c.color === color);
  // Chua chon anh thi xem truoc anh tam (chu cai dau) — thay doi theo ten va mau
  const anhXemTruoc = avatarUrl || anhTam(name || '?', color);

  async function doiAnh(file: File | undefined) {
    if (!file) return;
    setBusy('Đang tải ảnh lên…');
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Tải ảnh lỗi');
      setAvatarUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được ảnh.');
    } finally {
      setBusy(null);
    }
  }

  async function luu(themNua: boolean) {
    if (!name.trim()) return setError('Nhập tên của con đã.');

    setBusy('Đang lưu…');
    setError('');
    try {
      const res = await fetch('/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          grade,
          color,
          // Chua co anh that thi luu anh tam, bo me doi sau o man Sua ho so
          avatarUrl: avatarUrl || anhTam(name, color),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lưu không được');

      if (themNua) {
        setName('');
        setGrade('');
        setAvatarUrl('');
        setBusy(null);
        router.refresh();
      } else {
        router.push('/bome');
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được.');
      setBusy(null);
    }
  }

  return (
    <main className="px-p-page pt-4">
      <header className="flex items-center gap-2 mb-1">
        {!dauTien && (
          <Link href="/bome/cai-dat" className="min-h-p-tap flex items-center text-on-surface-variant pr-1">
            <span className="material-symbols-outlined text-3xl">arrow_back</span>
          </Link>
        )}
        <h1 className="text-p-headline-md text-on-background">
          {dauTien ? 'Thêm con đầu tiên' : 'Thêm con'}
        </h1>
      </header>
      <p className="text-p-body-sm text-on-surface-variant mb-4">
        {dauTien
          ? 'Xong bước này là nhập bài tập được rồi.'
          : 'Mỗi con một màu riêng để các con tự nhận ra mình.'}
      </p>

      <div className="bg-surface-container-lowest rounded-card card-shadow p-3 mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={anhXemTruoc}
            alt=""
            className="w-20 h-20 rounded-full object-cover bg-surface-container-high shrink-0"
          />
          <div className="flex-1">
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">Ảnh của con</label>
            <label
              className="inline-flex items-center gap-1.5 rounded-full px-4 min-h-p-tap border-2
                         border-primary text-primary text-p-body-sm font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">photo_camera</span>
              Chọn ảnh
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => doiAnh(e.target.files?.[0])}
              />
            </label>
            {!avatarUrl && (
              <p className="text-p-body-sm text-on-surface-variant mt-1">
                Chưa có thì để tạm chữ cái đầu, thay ảnh thật sau cũng được.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">Tên</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Minh"
              maxLength={40}
              className="w-full rounded-lg border border-outline-variant min-h-p-tap px-2 text-p-body
                         placeholder:text-outline bg-surface-container-lowest"
            />
          </div>
          <div className="flex-1">
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">Lớp</label>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Lớp 1"
              className="w-full rounded-lg border border-outline-variant min-h-p-tap px-2 text-p-body
                         placeholder:text-outline bg-surface-container-lowest"
            />
          </div>
        </div>

        <div>
          <label className="text-p-label uppercase text-on-surface-variant block mb-1">Màu riêng</label>
          <div className="flex gap-2">
            {MAU.map((m) => {
              const on = color === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => setColor(m.value)}
                  className={`flex items-center gap-1.5 rounded-full pl-1.5 pr-3 min-h-p-tap border-2
                              ${on
                                ? 'bg-primary border-primary text-on-primary'
                                : 'bg-surface-container-lowest border-surface-container-high text-on-surface'}`}
                >
                  <span className={`w-7 h-7 rounded-full ${m.swatch}`} />
                  <span className="text-p-body-sm font-bold">{m.ten}</span>
                </button>
              );
            })}
          </div>
          {trungMau && (
            <p className="text-p-body-sm text-on-surface-variant mt-1.5">
              {trungMau.name} cũng đang dùng màu này — các con sẽ khó tự nhận ra mình.
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-p-body text-error bg-error-container rounded-card p-3 mb-3">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => luu(true)}
          disabled={busy !== null}
          className="flex-1 rounded-card h-14 min-h-p-tap border-2 border-primary text-primary
                     text-p-body font-bold disabled:opacity-60"
        >
          Lưu và thêm con nữa
        </button>
        <button
          onClick={() => luu(false)}
          disabled={busy !== null}
          className="flex-1 rounded-card h-14 min-h-p-tap bg-primary text-on-primary
                     text-p-body font-bold card-shadow disabled:opacity-60"
        >
          {busy ?? 'Lưu và xong'}
        </button>
      </div>
    </main>
  );
}
