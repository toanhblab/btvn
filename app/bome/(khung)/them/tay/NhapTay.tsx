'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Child } from '@/lib/types';
import { SUBJECTS, iconFor } from '@/lib/types';

/**
 * Nhap tay tung bai — nen tu stitch-parent 03.
 * Day la duong lui bat buoc khi Gemini loi hoac het quota (PRD muc 10):
 * bo me phai luon nhap duoc bai, khong bao gio bi ket.
 */
export default function NhapTay({ children: kids }: { children: Child[] }) {
  const router = useRouter();
  const twins = kids.filter((c) => c.grade === 'Lớp 1').map((c) => c.id);

  const [chosen, setChosen] = useState<string[]>(twins.length ? twins : kids.slice(0, 1).map((c) => c.id));
  const [subject, setSubject] = useState('Toán');
  const [content, setContent] = useState('');
  const [note, setNote] = useState('');
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(0);

  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  async function save(themNua: boolean) {
    if (!content.trim()) return setError('Chưa nhập đề bài.');
    if (chosen.length === 0) return setError('Chọn ít nhất một con đã.');

    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childIds: chosen,
          dueDate,
          drafts: [{ subject, icon: iconFor(subject), content, note: note || null, lang, confidence: 1 }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lưu lỗi');

      setSaved((n) => n + 1);
      if (themNua) {
        setContent('');
        setNote('');
      } else {
        router.push('/bome');
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-p-page pt-4">
      <header className="flex items-center gap-2 mb-5">
        <Link href="/bome/them" className="min-h-p-tap flex items-center text-on-surface-variant pr-1">
          <span className="material-symbols-outlined text-3xl">arrow_back</span>
        </Link>
        <h1 className="text-p-headline text-on-background">Nhập tay</h1>
      </header>

      {saved > 0 && (
        <p className="text-p-body-sm text-on-success-container bg-success-container rounded-card p-3 mb-3">
          Đã lưu {saved} bài. Nhập tiếp hoặc bấm Xong.
        </p>
      )}

      <div className="bg-surface-container-lowest rounded-card card-shadow p-3 mb-4 flex flex-col gap-3">
        <div>
          <label className="text-p-label uppercase text-on-surface-variant block mb-1">Đề bài</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Ví dụ: Làm bài 3 trang 34, viết vào vở ô ly."
            className="w-full rounded-lg border border-outline-variant p-2 text-p-body resize-y
                       placeholder:text-outline bg-surface-container-lowest"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">Môn học</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-outline-variant min-h-p-tap px-2 text-p-body
                         bg-surface-container-lowest"
            >
              {Object.keys(SUBJECTS).map((s) => (
                <option key={s} value={s}>{SUBJECTS[s]} {s}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">Hạn chót</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-outline-variant min-h-p-tap px-2 text-p-body
                         bg-surface-container-lowest"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">Ghi chú</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="trang 34, bài 3"
              className="w-full rounded-lg border border-outline-variant min-h-p-tap px-2 text-p-body
                         placeholder:text-outline bg-surface-container-lowest"
            />
          </div>
          <div className="flex-1">
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">Giọng đọc</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as 'vi' | 'en')}
              className="w-full rounded-lg border border-outline-variant min-h-p-tap px-2 text-p-body
                         bg-surface-container-lowest"
            >
              <option value="vi">🇻🇳 Tiếng Việt</option>
              <option value="en">🇬🇧 Tiếng Anh</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-p-label uppercase text-on-surface-variant block mb-1">Giao cho</label>
          <div className="flex gap-2">
            {kids.map((c) => {
              const on = chosen.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`flex items-center gap-1.5 rounded-full pl-1 pr-3 min-h-p-tap border-2
                              ${on ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container-lowest border-surface-container-high text-on-surface'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  <span className="text-p-body-sm font-bold">{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && <p className="text-p-body text-error bg-error-container rounded-card p-3 mb-3">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => save(true)}
          disabled={busy}
          className="flex-1 rounded-card h-14 min-h-p-tap border-2 border-primary text-primary
                     text-p-body font-bold disabled:opacity-60"
        >
          Lưu và thêm nữa
        </button>
        <button
          onClick={() => save(false)}
          disabled={busy}
          className="flex-1 rounded-card h-14 min-h-p-tap bg-primary text-on-primary
                     text-p-body font-bold card-shadow disabled:opacity-60"
        >
          {busy ? 'Đang lưu…' : 'Lưu và xong'}
        </button>
      </div>
    </main>
  );
}
