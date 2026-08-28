'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Child, HwSource } from '@/lib/types';
import { HW_SOURCES } from '@/lib/types';

type Han = 'today' | 'tomorrow' | 'custom';

/** Man them bai tap — nen tu stitch-parent 07. */
export default function ThemBaiTap({ children: kids }: { children: Child[] }) {
  const router = useRouter();

  // PRD 4.2: hai be sinh doi hoc cung lop nen mac dinh tick san CA HAI. Truoc day
  // cho nay do chu "Lop 1" — dung voi nha cua tac gia, sai voi moi nha khac dung
  // app. Gio tick san nhung con HOC CUNG LOP voi con dau tien; khong ai cung lop
  // thi tick tat ca, bo me bo tick con khong can.
  const cungLop = kids.filter((c) => c.grade && c.grade === kids[0]?.grade).map((c) => c.id);
  const [chosen, setChosen] = useState<string[]>(
    cungLop.length > 1 ? cungLop : kids.map((c) => c.id)
  );

  const [text, setText] = useState('');
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [han, setHan] = useState<Han>('today');
  // Noi giao bai. null = de AI doan theo noi dung (de tieng Anh -> lop tieng
  // Anh); bo me chon tay thi lua chon do thang, AI khong ghi de.
  const [hwSource, setHwSource] = useState<HwSource | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  function dueDate(): string {
    if (han === 'custom' && customDate) return customDate;
    const d = new Date();
    if (han === 'tomorrow') d.setDate(d.getDate() + 1);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy('Đang tải ảnh lên…');
    setError('');
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Tải ảnh lỗi');
        setImages((prev) => [...prev, { url: data.url, name: file.name }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được ảnh.');
    } finally {
      setBusy(null);
    }
  }

  /** Goi AI tach bai roi chuyen sang man "Kiem tra lai" cho bo me duyet. */
  async function tachBai() {
    if (chosen.length === 0) return setError('Chọn ít nhất một con đã.');
    if (!text.trim() && images.length === 0) return setError('Chụp ảnh hoặc dán nội dung bài tập vào.');

    setBusy('Đang đọc bài tập…');
    setError('');
    try {
      // Anh dang data URL thi tach lay phan base64 gui cho AI doc
      const payloadImages = images
        .filter((i) => i.url.startsWith('data:'))
        .map((i) => ({
          mimeType: i.url.slice(5, i.url.indexOf(';')),
          base64: i.url.slice(i.url.indexOf(',') + 1),
        }));

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, images: payloadImages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Tách bài lỗi');

      sessionStorage.setItem(
        'btvn:draft',
        JSON.stringify({
          drafts: data.drafts,
          warning: data.warning ?? null,
          source: data.source,
          // Bo me da chon thi lay lua chon do; chua chon thi lay goi y cua AI
          hwSource: hwSource ?? data.hwSource ?? 'primary_school',
          childIds: chosen,
          dueDate: dueDate(),
          rawText: text || null,
          imageUrls: images.map((i) => i.url),
        })
      );
      router.push('/bome/kiem-tra');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tách được bài.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="px-p-page pt-4">
      <header className="flex items-center gap-2 mb-5">
        <Link href="/bome" className="min-h-p-tap flex items-center text-on-surface-variant pr-1">
          <span className="material-symbols-outlined text-3xl">arrow_back</span>
        </Link>
        <h1 className="text-p-headline text-primary">Thêm bài tập</h1>
      </header>

      {/* ---- Anh bai tap ---- */}
      <section className="mb-5">
        <p className="text-p-label uppercase text-on-surface-variant mb-2">Ảnh bài tập</p>
        <label
          className="block border-2 border-dashed border-outline-variant rounded-card p-6 text-center
                     bg-surface-container-lowest cursor-pointer"
        >
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <span className="material-symbols-outlined text-4xl text-primary">photo_camera</span>
          <p className="text-p-body-sm text-on-surface-variant mt-1">
            Chụp ảnh hoặc chọn ảnh từ Zalo
          </p>
        </label>

        {images.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="w-16 h-16 rounded-lg object-cover border border-surface-container-high" />
                <button
                  onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-inverse-surface text-white
                             flex items-center justify-center"
                  aria-label="Bỏ ảnh"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Dan text ---- */}
      <section className="mb-5">
        <p className="text-p-label uppercase text-on-surface-variant mb-2">Hoặc dán nội dung</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Dán tin nhắn của cô giáo vào đây…"
          className="w-full rounded-card border border-outline-variant bg-surface-container-lowest
                     p-3 text-p-body text-on-surface placeholder:text-outline resize-y"
        />
      </section>

      {/* ---- Chon con ---- */}
      <section className="mb-5">
        <p className="text-p-label uppercase text-on-surface-variant mb-2">Giao cho con nào</p>
        <div className="flex gap-2">
          {kids.map((c) => {
            const on = chosen.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`flex-1 rounded-card p-2 flex flex-col items-center gap-1 border-2 transition-colors
                            min-h-p-tap ${on ? 'bg-primary border-primary' : 'bg-surface-container-lowest border-surface-container-high'}`}
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                  {on && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-primary
                                     flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm icon-fill">check</span>
                    </span>
                  )}
                </div>
                <span className={`text-p-body-sm font-bold ${on ? 'text-on-primary' : 'text-on-surface'}`}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
        {cungLop.length > 1 && (
          <p className="text-p-body-sm text-on-surface-variant bg-surface-container rounded-lg p-2 mt-2">
            Các con học cùng {kids[0]?.grade} được chọn sẵn. Mỗi con vẫn có bài
            riêng để tự tick.
          </p>
        )}
      </section>

      {/* ---- Noi giao bai: mot nut cho moi ma trong HW_SOURCES ---- */}
      <section className="mb-5">
        <p className="text-p-label uppercase text-on-surface-variant mb-2">Bài của lớp nào</p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setHwSource(null)}
            className={`px-4 min-h-p-tap rounded-full text-p-body-sm font-bold border
                        ${hwSource === null
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-lowest text-on-surface-variant border-surface-container-high'}`}
          >
            ✨ Tự đoán
          </button>
          {(Object.keys(HW_SOURCES) as HwSource[]).map((s) => (
            <button
              key={s}
              onClick={() => setHwSource(s)}
              className={`px-4 min-h-p-tap rounded-full text-p-body-sm font-bold border
                          ${hwSource === s
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface-container-lowest text-on-surface-variant border-surface-container-high'}`}
            >
              {HW_SOURCES[s].icon} {HW_SOURCES[s].label}
            </button>
          ))}
        </div>
        {hwSource === null && (
          <p className="text-p-body-sm text-on-surface-variant mt-2">
            Đề tiếng Anh sẽ tự xếp vào “Smartkid”, còn lại vào “Nguyễn Siêu”. Chọn “Khác” nếu bài không của hai nơi này.
            Bố mẹ vẫn sửa được ở bước kiểm tra lại.
          </p>
        )}
      </section>

      {/* ---- Han hoan thanh ---- */}
      <section className="mb-6">
        <p className="text-p-label uppercase text-on-surface-variant mb-2">Hạn hoàn thành</p>
        <div className="flex gap-2 items-center flex-wrap">
          {([['today', 'Hôm nay'], ['tomorrow', 'Mai'], ['custom', 'Chọn ngày']] as [Han, string][]).map(
            ([v, label]) => (
              <button
                key={v}
                onClick={() => setHan(v)}
                className={`px-4 min-h-p-tap rounded-full text-p-body-sm font-bold border
                            ${han === v
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-surface-container-lowest text-on-surface-variant border-surface-container-high'}`}
              >
                {label}
              </button>
            )
          )}
          {han === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="rounded-card border border-outline-variant bg-surface-container-lowest px-3 min-h-p-tap text-p-body"
            />
          )}
        </div>
      </section>

      {error && (
        <p className="text-p-body text-error bg-error-container rounded-card p-3 mb-3">{error}</p>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={tachBai}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 bg-primary text-on-primary rounded-card
                     h-14 min-h-p-tap text-p-body font-bold card-shadow disabled:opacity-60"
        >
          <span className="material-symbols-outlined">auto_awesome</span>
          {busy ?? 'Tách bài tập'}
        </button>

        {/* Duong lui bat buoc khi AI hong hoac het quota (PRD muc 10) */}
        <Link
          href="/bome/them/tay"
          className="flex items-center justify-center gap-2 rounded-card h-12 min-h-p-tap
                     border-2 border-primary text-primary text-p-body-sm font-bold"
        >
          <span className="material-symbols-outlined text-xl">edit_note</span>
          Nhập tay từng bài
        </Link>
      </div>
    </main>
  );
}
