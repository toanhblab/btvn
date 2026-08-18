'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Child, DraftAssignment } from '@/lib/types';
import { SUBJECTS, iconFor } from '@/lib/types';

interface Payload {
  drafts: DraftAssignment[];
  warning: string | null;
  source: 'ai' | 'rule';
  childIds: string[];
  dueDate: string;
  rawText: string | null;
  imageUrls: string[];
}

/** Man kiem tra lai — nen tu stitch-parent 08. Ban nhap se KHONG luu neu bo me chua bam. */
export default function KiemTraLai({ children: kids }: { children: Child[] }) {
  const router = useRouter();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [drafts, setDrafts] = useState<DraftAssignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('btvn:draft');
    if (!raw) { router.replace('/bome/them'); return; }
    const p = JSON.parse(raw) as Payload;
    setPayload(p);
    setDrafts(p.drafts);
  }, [router]);

  if (!payload) return null;

  const chosenNames = kids.filter((c) => payload.childIds.includes(c.id)).map((c) => c.name);

  const patch = (i: number, k: keyof DraftAssignment, v: unknown) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, [k]: v } : d)));

  const remove = (i: number) => setDrafts((ds) => ds.filter((_, j) => j !== i));

  const addBlank = () =>
    setDrafts((ds) => [
      ...ds,
      { subject: 'Khác', icon: iconFor('Khác'), content: '', note: null, lang: 'vi', confidence: 1 },
    ]);

  /** Gop bai nay vao bai ngay tren — AI hay tach nham mot bai thanh hai dong. */
  const mergeUp = (i: number) =>
    setDrafts((ds) =>
      ds.reduce<DraftAssignment[]>((acc, d, j) => {
        if (j === i && acc.length) {
          const prev = acc[acc.length - 1];
          acc[acc.length - 1] = { ...prev, content: `${prev.content} ${d.content}`.trim() };
          return acc;
        }
        return [...acc, d];
      }, [])
    );

  async function save() {
    const clean = drafts.filter((d) => d.content.trim());
    if (clean.length === 0) return setError('Chưa có bài nào để lưu.');

    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childIds: payload!.childIds,
          dueDate: payload!.dueDate,
          rawText: payload!.rawText,
          imageUrls: payload!.imageUrls,
          drafts: clean,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lưu lỗi');
      sessionStorage.removeItem('btvn:draft');
      router.push('/bome');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được.');
    } finally {
      setBusy(false);
    }
  }

  const BAR: Record<string, string> = {
    'Toán': 'bg-primary', 'Tiếng Việt': 'bg-secondary-container',
    'Tiếng Anh': 'bg-tertiary-container', 'Vẽ': 'bg-success',
    'Tự nhiên': 'bg-secondary', 'Khác': 'bg-outline',
  };

  return (
    <main className="px-p-page pt-4">
      <header className="flex items-start gap-2 mb-4">
        <Link href="/bome/them" className="min-h-p-tap flex items-center text-on-surface-variant pr-1">
          <span className="material-symbols-outlined text-3xl">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-p-headline text-on-background">Kiểm tra lại</h1>
          <p className="text-p-body-sm text-on-surface-variant">
            {drafts.length} bài cho {chosenNames.join(' và ') || 'con'} · hạn {payload.dueDate}
          </p>
        </div>
      </header>

      {payload.warning && (
        <p className="text-p-body-sm text-on-error-container bg-error-container rounded-card p-3 mb-3">
          {payload.warning}
        </p>
      )}

      {/* Nhac LUON hien khi ban nhap den tu AI.
          Truoc day cho nay dua vao diem "confidence" model tu cham, nhung do
          bang anh that thi model tra ve 1 cho moi bai — ke ca bai no vua bo sot
          mot y — nen canh bao khong bao gio bat. Doi sang nhac theo nguon: da la
          AI doc ho thi bo me phai doi chieu, khong co ngoai le. */}
      {payload.source === 'ai' && (
        <p className="text-p-body-sm text-on-surface-variant bg-surface-container rounded-card p-3 mb-3">
          AI đọc hộ nên có thể sót ý hoặc tách nhầm. Bố mẹ đối chiếu với ảnh gốc
          một lượt trước khi lưu nhé.
        </p>
      )}

      <div className="flex flex-col gap-p-tight mb-4">
        {drafts.map((d, i) => (
          <div key={i}>
            {i > 0 && (
              <button
                onClick={() => mergeUp(i)}
                className="text-p-body-sm text-primary py-1 px-2 min-h-p-tap w-full text-left"
              >
                + Gộp với bài trên
              </button>
            )}
            <div className="bg-surface-container-lowest rounded-card card-shadow relative overflow-hidden p-3 pl-4">
              <div className={`absolute left-0 inset-y-0 w-1 ${BAR[d.subject] ?? BAR['Khác']}`} />

              <div className="flex items-start gap-2">
                <textarea
                  value={d.content}
                  onChange={(e) => patch(i, 'content', e.target.value)}
                  rows={2}
                  placeholder="Đề bài…"
                  className="flex-1 bg-transparent text-p-body text-on-surface resize-y outline-none
                             border-b border-dashed border-outline-variant pb-1"
                />
                <button
                  onClick={() => remove(i)}
                  className="text-outline hover:text-error min-h-p-tap px-1"
                  aria-label="Xoá bài"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <select
                  value={d.subject}
                  onChange={(e) => {
                    patch(i, 'subject', e.target.value);
                    patch(i, 'icon', iconFor(e.target.value));
                  }}
                  className="text-p-body-sm rounded-full bg-surface-container px-3 py-1.5 text-on-surface"
                >
                  {Object.keys(SUBJECTS).map((s) => (
                    <option key={s} value={s}>{SUBJECTS[s]} {s}</option>
                  ))}
                </select>

                {/* Ngon ngu quyet dinh giong doc o man cua con — phai sua duoc (PRD 4.2) */}
                <select
                  value={d.lang}
                  onChange={(e) => patch(i, 'lang', e.target.value)}
                  className="text-p-body-sm rounded-full bg-surface-container px-3 py-1.5 text-on-surface"
                >
                  <option value="vi">🇻🇳 Đọc giọng Việt</option>
                  <option value="en">🇬🇧 Đọc giọng Anh</option>
                </select>

                <input
                  value={d.note ?? ''}
                  onChange={(e) => patch(i, 'note', e.target.value || null)}
                  placeholder="trang, bài…"
                  className="text-p-body-sm rounded-full bg-surface-container px-3 py-1.5 text-on-surface
                             placeholder:text-outline w-28"
                />

                {/* Chi con ban tach tho theo dong (0.3) moi roi xuong duoi nguong */}
                {d.confidence < 0.6 && (
                  <span className="inline-flex items-center gap-1 text-p-body-sm text-error">
                    <span className="material-symbols-outlined text-base">warning</span>
                    Tách tạm, chưa qua AI
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addBlank}
        className="w-full border-2 border-dashed border-outline-variant rounded-card
                   min-h-p-tap text-p-body-sm text-primary mb-4"
      >
        + Thêm bài mới
      </button>

      {error && <p className="text-p-body text-error bg-error-container rounded-card p-3 mb-3">{error}</p>}

      <div className="flex gap-2">
        <Link
          href="/bome/them"
          className="flex-1 flex items-center justify-center rounded-card h-14 min-h-p-tap
                     border-2 border-outline-variant text-on-surface-variant text-p-body"
        >
          Huỷ
        </Link>
        <button
          onClick={save}
          disabled={busy}
          className="flex-[2] flex items-center justify-center gap-2 bg-success text-white rounded-card
                     h-14 min-h-p-tap text-p-body font-bold card-shadow disabled:opacity-60"
        >
          {busy ? 'Đang lưu…' : `Lưu ${drafts.length} bài tập`}
        </button>
      </div>
    </main>
  );
}
