'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Child, ChildColor } from '@/lib/types';

const MAU: { value: ChildColor; ten: string; swatch: string }[] = [
  { value: 'primary',   ten: 'Xanh', swatch: 'bg-primary' },
  { value: 'secondary', ten: 'Cam',  swatch: 'bg-secondary-container' },
  { value: 'tertiary',  ten: 'Vàng', swatch: 'bg-tertiary-fixed-dim' },
];

/**
 * @param soBai      So bai tap cua con nay — hien ra khi hoi truoc luc xoa, vi
 *                   xoa con la xoa luon bai (ON DELETE CASCADE).
 * @param laConCuoi  Con duy nhat cua nha: xoa xong man cua con se trong khong,
 *                   nen noi truoc.
 */
export default function SuaHoSo({
  child,
  others,
  soBai,
  laConCuoi,
}: {
  child: Child;
  others: Child[];
  soBai: number;
  laConCuoi: boolean;
}) {
  const router = useRouter();
  const [hoiXoa, setHoiXoa] = useState(false);

  const [name, setName] = useState(child.name);
  const [grade, setGrade] = useState(child.grade ?? '');
  const [color, setColor] = useState<ChildColor>(child.color);
  const [avatarUrl, setAvatarUrl] = useState(child.avatarUrl);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Con nao dang giu mau nay. Hai be sinh doi trung mau thi mat luon cach phan
  // biet nhau o man chon con (PRD muc 3) — canh bao chu khong chan, biet dau bo
  // me dang doi mau qua lai giua hai be.
  const trungMau = others.find((c) => c.color === color);

  /** Dung chung /api/upload voi luong nhap bai; chua bat Blob thi tra data URL. */
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

  async function luu() {
    if (!name.trim()) return setError('Nhập tên của con đã.');
    setBusy('Đang lưu…');
    setError('');
    try {
      const res = await fetch(`/api/children/${child.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), grade, color, avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lưu không được');
      router.push(`/bome/con/${child.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được.');
      setBusy(null);
    }
  }

  /** Xoa con nay. Hoi lai ngay tai cho chu khong dung confirm(): khong lay lai duoc. */
  async function xoa() {
    setBusy('Đang xoá…');
    setError('');
    try {
      const res = await fetch(`/api/children/${child.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Xoá không được');
      router.push('/bome/cai-dat');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xoá được.');
      setBusy(null);
    }
  }

  // Man nay chua co ban thiet ke Macbook (issue #15 de lai): tu 1280px giu
  // nguyen cot hep nhu tren dien thoai, chi khac la co thanh ben trai.
  return (
    <main className="px-p-page pt-4 xl:max-w-lg xl:mx-auto">
      <header className="flex items-center gap-2 mb-4">
        <Link
          href={`/bome/con/${child.id}`}
          className="min-h-p-tap flex items-center text-on-surface-variant pr-1"
        >
          <span className="material-symbols-outlined text-3xl">arrow_back</span>
        </Link>
        <h1 className="text-p-headline-md text-on-background">Sửa hồ sơ</h1>
      </header>

      <div className="bg-surface-container-lowest rounded-card card-shadow p-3 mb-4 flex flex-col gap-3">
        {/* Anh — de to vi day la thu tre nhin de nhan ra minh */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
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
              Đổi ảnh
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => doiAnh(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">Tên</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Minh"
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
        <Link
          href={`/bome/con/${child.id}`}
          className="flex-1 rounded-card h-14 min-h-p-tap border-2 border-primary text-primary
                     text-p-body font-bold flex items-center justify-center"
        >
          Huỷ
        </Link>
        <button
          onClick={luu}
          disabled={busy !== null}
          className="flex-1 rounded-card h-14 min-h-p-tap bg-primary text-on-primary
                     text-p-body font-bold card-shadow disabled:opacity-60"
        >
          {busy ?? 'Lưu'}
        </button>
      </div>

      {/* Xoa con — de duoi cung va tach ra khoi nut Luu cho khoi bam nham */}
      <div className="mt-8 mb-4">
        {!hoiXoa ? (
          <button
            onClick={() => setHoiXoa(true)}
            className="w-full rounded-card min-h-p-tap border-2 border-error-container text-error
                       text-p-body-sm font-bold flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-xl">person_remove</span>
            Xoá {child.name} khỏi nhà mình
          </button>
        ) : (
          <div className="bg-error-container rounded-card p-3">
            <p className="text-p-body text-on-error-container font-bold mb-0.5">
              Xoá {child.name}?
            </p>
            <p className="text-p-body-sm text-on-error-container mb-3">
              {soBai > 0
                ? `Mất luôn ${soBai} bài tập của ${child.name}. Không lấy lại được.`
                : 'Không lấy lại được.'}
              {laConCuoi && ' Đây là con duy nhất — màn hình của con sẽ trống.'}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setHoiXoa(false)}
                disabled={busy !== null}
                className="flex-1 rounded-card min-h-p-tap bg-surface-container-lowest text-on-surface
                           text-p-body-sm font-bold disabled:opacity-60"
              >
                Thôi, giữ lại
              </button>
              <button
                onClick={xoa}
                disabled={busy !== null}
                className="flex-1 rounded-card min-h-p-tap bg-error text-white
                           text-p-body-sm font-bold disabled:opacity-60"
              >
                Xoá
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
