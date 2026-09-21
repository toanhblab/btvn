'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Assignment, AttachedMedia, HwSource } from '@/lib/types';
import { DURATION_DEFAULT, HW_SOURCES, iconFor, subjectsFor } from '@/lib/types';
import { useNgonNgu, useT } from '@/lib/i18n/client';
import { giaTriGiong, luaChonGiong } from '@/lib/speech';
import { MEDIA_ACCEPT, MEDIA_ICON, linkDriveTu, uploadMediaFile } from '@/lib/media';
import { gioNha } from '@/lib/ngay';

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
  const T = useT();
  const ngonNgu = useNgonNgu();
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
  const [driveUrl, setDriveUrl] = useState('');
  const [driveError, setDriveError] = useState('');

  const back = `/bome/con/${assignment.childId}`;

  // Link Google Drive (issue #28) khong tai len nhu tep — luu thang url voi kind
  // 'video', hien phan biet o luc render bang linkDriveTu. Tu issue #60 con bam
  // la MO SANG Drive chu khong xem trong app, nen link thu muc (ca album) cung
  // nhan duoc, khong con phai la link mot tep.
  function addDriveLink() {
    const link = linkDriveTu(driveUrl.trim());
    if (!link) {
      setDriveError(T('Link chưa đúng — phải là link Google Drive (drive.google.com/…).'));
      return;
    }
    setMedia((prev) => [...prev, { url: link, name: T('Link Google Drive'), kind: 'video' }]);
    setDriveUrl('');
    setDriveError('');
  }

  async function onPickMedia(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        const m = await uploadMediaFile(file, blobEnabled, T);
        setMedia((prev) => [...prev, m]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : T('Không tải được tệp.'));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!content.trim()) return setError(T('Đề bài không được để trống.'));
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
      if (!res.ok) throw new Error(data.error ?? T('Lưu lỗi'));
      router.push(back);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : T('Không lưu được.'));
      setBusy(false);
    }
  }

  // Man nay chua co ban thiet ke Macbook (issue #15 de lai): tu 1280px giu
  // nguyen cot hep nhu tren dien thoai, chi khac la co thanh ben trai.
  return (
    <main className="px-p-page pt-4 xl:max-w-lg xl:mx-auto">
      <header className="flex items-center gap-2 mb-5">
        <Link href={back} className="min-h-p-tap flex items-center text-on-surface-variant pr-1">
          <span className="material-symbols-outlined text-3xl">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-p-headline text-on-background">{T('Sửa bài tập')}</h1>
          {childName && (
            <p className="text-p-body-sm text-on-surface-variant">
              {T('Bài của {name} · hạn {date}', { name: childName, date: assignment.dueDate })}
            </p>
          )}
        </div>
      </header>

      <div className="bg-surface-container-lowest rounded-card card-shadow p-3 mb-4 flex flex-col gap-3">
        <div>
          <label className="text-p-label uppercase text-on-surface-variant block mb-1">{T('Đề bài')}</label>
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
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">{T('Môn học')}</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-outline-variant min-h-p-tap px-2 text-p-body
                         bg-surface-container-lowest"
            >
              {/* Mon dang luu co the khong nam trong danh sach (AI dat ten, hay nha doi
                  ngon ngu) — giu no lam mot lua chon de select khong hien trong. */}
              {Object.entries({ ...(subject in subjectsFor(T) ? {} : { [subject]: iconFor(subject) }), ...subjectsFor(T) }).map(([s, icon]) => (
                <option key={s} value={s}>{icon} {s}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">{T('Hạn chót')}</label>
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
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">{T('Sách / trang')}</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={T('Vở ô ly — bài 3 trang 34')}
              className="w-full rounded-lg border border-outline-variant min-h-p-tap px-2 text-p-body
                         placeholder:text-outline bg-surface-container-lowest"
            />
          </div>
          <div className="flex-1">
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">{T('Giọng đọc')}</label>
            <select
              value={giaTriGiong(ngonNgu, lang)}
              onChange={(e) => setLang(e.target.value as 'vi' | 'en')}
              className="w-full rounded-lg border border-outline-variant min-h-p-tap px-2 text-p-body
                         bg-surface-container-lowest"
            >
              {luaChonGiong(ngonNgu, T).map((o) => (
                <option key={o.value} value={o.value}>{o.nhan}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Nhap xong moi thay xep nham nhom (AI doan sai chang han) thi sua o day */}
        <div>
          <label className="text-p-label uppercase text-on-surface-variant block mb-1">{T('Bài của lớp nào')}</label>
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
                {HW_SOURCES[s].icon} {T(HW_SOURCES[s].label)}
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
            🎥 {T('Bài này cần con quay video nộp lại')}
          </span>
        </label>

        {/* Video con da nop — bo me xem lai ngay tai day de kiem tra bai */}
        {assignment.submittedVideoUrl && (
          <div>
            <label className="text-p-label uppercase text-on-surface-variant block mb-1">
              {T('Video con đã nộp')}
              {assignment.submittedVideoAt && ` — ${gioNha(assignment.submittedVideoAt, true)}`}
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
            {T('Thời lượng làm bài (phút)')}
          </label>
          {/* Dong ho o man cua con dem nguoc tu so nay. AI uoc 5-60;
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
            {T('Đính kèm — video, ghi âm, ảnh')}
          </label>

          {media.length > 0 && (
            <div className="flex flex-col gap-3 mb-2">
              {media.map((m) => {
                // Video co the la tep tai len hoac link Drive dan tay (issue #28) —
                // phan biet bang chinh HINH DANG url, khong them gia tri kind moi.
                const driveUrlDaLuu = m.kind === 'video' ? linkDriveTu(m.url) : null;
                return (
                  <div key={m.url} className="bg-surface-container rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="material-symbols-outlined text-lg text-primary shrink-0">
                        {MEDIA_ICON[m.kind]}
                      </span>
                      <span className="text-p-body-sm text-on-surface truncate flex-1">
                        {m.name || T('Tệp đính kèm')}
                      </span>
                      <button
                        onClick={() => setMedia((p) => p.filter((x) => x.url !== m.url))}
                        className="text-outline hover:text-error min-h-p-tap px-1 shrink-0"
                        aria-label={T('Bỏ tệp {name}', { name: m.name })}
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                    {/* Xem/nghe lai duoc ngay tai day de chac la dinh dung tep. Rieng
                        link Drive thi mo sang Drive — giong het thu con se thay (#60). */}
                    {driveUrlDaLuu && (
                      <a
                        href={driveUrlDaLuu}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 min-h-p-tap px-2 rounded-lg
                                   bg-surface-container-lowest text-primary text-p-body-sm"
                      >
                        <span className="material-symbols-outlined text-lg shrink-0">open_in_new</span>
                        <span className="truncate">{T('Mở link này trên Google Drive')}</span>
                      </a>
                    )}
                    {m.kind === 'video' && !driveUrlDaLuu && (
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
                );
              })}
            </div>
          )}

          <div className="flex gap-2 mb-2">
            <input
              value={driveUrl}
              onChange={(e) => {
                setDriveUrl(e.target.value);
                setDriveError('');
              }}
              placeholder={T('Dán link Google Drive — phim hoặc thư mục ảnh')}
              className="flex-1 rounded-lg border border-outline-variant min-h-p-tap px-2 text-p-body
                         placeholder:text-outline bg-surface-container-lowest"
            />
            <button
              type="button"
              onClick={addDriveLink}
              className="px-4 min-h-p-tap rounded-lg bg-surface-container-high text-on-surface-variant
                         text-p-body-sm font-bold shrink-0"
            >
              {T('Thêm')}
            </button>
          </div>
          {driveError && <p className="text-p-body-sm text-error mb-2">{driveError}</p>}

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
              {uploading ? T('Đang tải lên…') : T('Thêm tệp — ví dụ video luyện phát âm, ghi âm cô đọc mẫu')}
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
          {T('Huỷ')}
        </Link>
        <button
          onClick={save}
          disabled={busy || uploading}
          className="flex-[2] flex items-center justify-center gap-2 bg-primary text-on-primary rounded-card
                     h-14 min-h-p-tap text-p-body font-bold card-shadow disabled:opacity-60"
        >
          {busy ? T('Đang lưu…') : T('Lưu thay đổi')}
        </button>
      </div>
    </main>
  );
}
