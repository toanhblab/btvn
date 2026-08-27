'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Assignment, AttachedMedia, HwSource } from '@/lib/types';
import { DURATION_DEFAULT, HW_SOURCES, SUBJECTS, iconFor } from '@/lib/types';
import { MEDIA_ACCEPT, MEDIA_ICON, uploadMediaFile } from '@/lib/media';

/**
 * Gio nop video hien ra o day duoc SSR (trang la force-dynamic) roi hydrate lai
 * o may bo me. Ham Vercel chay TZ=UTC, iPad cua bo me la +07 — khong chot mui
 * gio thi hai ben ra hai chuoi khac nhau: React bao hydration mismatch va bo me
 * doc phai gio lech 7 tieng o lan ve dau. Chot theo mui gio nha, dung gia dinh
 * "gio may chu la gio nha" ma todayISO() (lib/store.ts) da dung.
 */
const MUI_GIO_NHA = 'Asia/Ho_Chi_Minh';

/**
 * Form sua mot bai da giao. Bo cuc va ten nhan bam theo man Nhap tay de bo me
 * khong phai hoc lai — cung nhung o do, chi khac la co san noi dung.
 */
export default function SuaBai({
  assignment,
  childName,
  blobEnabled,
}: {
  assignment: Assignment;
  childName: string;
  blobEnabled: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(assignment.subject);
  const [content, setContent] = useState(assignment.content);
  const [note, setNote] = useState(assignment.note ?? '');
  const [lang, setLang] = useState<'vi' | 'en'>(assignment.lang);
  const [dueDate, setDueDate] = useState(assignment.dueDate);
  const [hwSource, setHwSource] = useState<HwSource>(assignment.source);
  // Giu dang chuoi de bo me xoa trong o roi go so moi; luu thi rong = mac dinh
  const [duration, setDuration] = useState(String(assignment.durationMinutes));
  const [requiresVideo, setRequiresVideo] = useState(assignment.requiresVideo);
  const [media, setMedia] = useState<AttachedMedia[]>(assignment.media);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const back = `/bome/con/${assignment.childId}`;

  async function onPickMedia(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        const m = await uploadMediaFile(file, blobEnabled);
        setMedia((prev) => [...prev, m]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được tệp.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!content.trim()) return setError('Đề bài không được để trống.');
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/assignments/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          icon: iconFor(subject),
          content,
          note: note || null,
          lang,
          dueDate,
          source: hwSource,
          durationMinutes: duration === '' ? DURATION_DEFAULT : Number(duration),
          requiresVideo,
          media,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lưu lỗi');
      router.push(back);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được.');
      setBusy(false);
    }
  }

  return (
    <main className="px-p-page pt-4">
      <header className="flex items-center gap-2 mb-5">
        <Link href={back} className="min-h-p-tap flex items-center text-on-surface-variant pr-1">
          <span className="material-symbols-outlined text-3xl">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-p-headline text-on-background">Sửa bài tập</h1>
          {childName && (
            <p className="text-p-body-sm text-on-surface-variant">
              Bài của {childName} · hạn {assignment.dueDate}
            </p>
          )}
        </div>
      </header>

      <div className="bg-surface-container-lowest rounded-card card-shadow p-3 mb-4 flex flex-col gap-3">
        <div>
          <label className="text-p-label uppercase text-on-surface-variant block mb-1">Đề bài</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-outline-variant p-2 text-p-body resize-y
                       bg-surface-container-lowest"
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
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">Sách / trang</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vở ô ly — bài 3 trang 34"
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

        {/* Nhap xong moi thay xep nham nhom (AI doan sai chang han) thi sua o day */}
        <div>
          <label className="text-p-label uppercase text-on-surface-variant block mb-1">Bài của lớp nào</label>
          <div className="flex gap-2 flex-wrap">
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
        </div>

        {/* AI danh dau luc tach bai nhung co the sot hoac danh nham — bo me la
            nguoi quyet cuoi. Bat co nay thi con phai quay video moi tick xong duoc. */}
        <label className="flex items-center gap-2 min-h-p-tap cursor-pointer">
          <input
            type="checkbox"
            checked={requiresVideo}
            onChange={(e) => setRequiresVideo(e.target.checked)}
            className="w-5 h-5 accent-primary shrink-0"
          />
          <span className="text-p-body text-on-surface">
            🎥 Bài này cần con quay video nộp lại
          </span>
        </label>

        {/* Video con da nop — bo me xem lai ngay tai day de kiem tra bai */}
        {assignment.submittedVideoUrl && (
          <div>
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">
              Video con đã nộp
              {assignment.submittedVideoAt &&
                ` — ${new Date(assignment.submittedVideoAt).toLocaleString('vi-VN', { timeZone: MUI_GIO_NHA })}`}
            </label>
            <video
              src={assignment.submittedVideoUrl}
              controls
              playsInline
              preload="metadata"
              className="w-full max-h-64 rounded-lg bg-black"
            />
          </div>
        )}

        <div>
          <label className="text-p-label uppercase text-on-surface-variant block mb-1">
            Thời lượng làm bài (phút)
          </label>
          {/* Dong ho o man cua con dem nguoc tu so nay. AI uoc 5-15;
              bo me sua tay thi duoc ghi ngoai khoang do (toi da 180). */}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={180}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full rounded-lg border border-outline-variant min-h-p-tap px-2 text-p-body
                       bg-surface-container-lowest"
          />
        </div>

        <div>
          <label className="text-p-label uppercase text-on-surface-variant block mb-1">
            Đính kèm — video, ghi âm, ảnh
          </label>

          {media.length > 0 && (
            <div className="flex flex-col gap-3 mb-2">
              {media.map((m) => (
                <div key={m.url} className="bg-surface-container rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="material-symbols-outlined text-lg text-primary shrink-0">
                      {MEDIA_ICON[m.kind]}
                    </span>
                    <span className="text-p-body-sm text-on-surface truncate flex-1">
                      {m.name || 'Tệp đính kèm'}
                    </span>
                    <button
                      onClick={() => setMedia((p) => p.filter((x) => x.url !== m.url))}
                      className="text-outline hover:text-error min-h-p-tap px-1 shrink-0"
                      aria-label={`Bỏ tệp ${m.name}`}
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>
                  {/* Xem/nghe lai duoc ngay tai day de chac la dinh dung tep */}
                  {m.kind === 'video' && (
                    <video
                      src={m.url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full max-h-48 rounded-lg bg-black"
                    />
                  )}
                  {m.kind === 'audio' && (
                    <audio src={m.url} controls preload="metadata" className="w-full" />
                  )}
                  {m.kind === 'image' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt=""
                      className="w-full max-h-48 object-contain rounded-lg bg-surface-container-lowest"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <label
            className="flex items-center gap-2 border border-dashed border-outline-variant rounded-lg
                       min-h-p-tap px-2 cursor-pointer text-on-surface-variant"
          >
            <input
              type="file"
              accept={MEDIA_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                onPickMedia(e.target.files);
                e.target.value = ''; // chon lai cung mot tep van phai chay
              }}
            />
            <span className="material-symbols-outlined text-xl text-primary">attach_file</span>
            <span className="text-p-body-sm">
              {uploading ? 'Đang tải lên…' : 'Thêm tệp — ví dụ video luyện phát âm, ghi âm cô đọc mẫu'}
            </span>
          </label>
        </div>
      </div>

      {error && <p className="text-p-body text-error bg-error-container rounded-card p-3 mb-3">{error}</p>}

      <div className="flex gap-2">
        <Link
          href={back}
          className="flex-1 flex items-center justify-center rounded-card h-14 min-h-p-tap
                     border-2 border-outline-variant text-on-surface-variant text-p-body"
        >
          Huỷ
        </Link>
        <button
          onClick={save}
          disabled={busy || uploading}
          className="flex-[2] flex items-center justify-center gap-2 bg-primary text-on-primary rounded-card
                     h-14 min-h-p-tap text-p-body font-bold card-shadow disabled:opacity-60"
        >
          {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
      </div>
    </main>
  );
}
