'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Child, DraftAssignment, HwSource } from '@/lib/types';
import { DURATION_DEFAULT, HW_SOURCES, SUBJECTS, hwSourceOf, iconFor } from '@/lib/types';
import { MEDIA_ACCEPT, MEDIA_ICON, uploadMediaFile } from '@/lib/media';

interface Payload {
  drafts: DraftAssignment[];
  warning: string | null;
  source: 'ai' | 'rule';
  /** Noi giao ca dot (lop tieng Anh / truong tieu hoc) — sua duoc o day. */
  hwSource?: HwSource;
  childIds: string[];
  dueDate: string;
  rawText: string | null;
  imageUrls: string[];
}

// Giu dang chuoi de bo me xoa trong o roi go so moi; luu thi rong = mac dinh
type Draft = DraftAssignment & { durationStr: string };

/** Man kiem tra lai — nen tu stitch-parent 08. Ban nhap se KHONG luu neu bo me chua bam. */
export default function KiemTraLai({
  children: kids,
  blobEnabled,
}: {
  children: Child[];
  blobEnabled: boolean;
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [hwSource, setHwSource] = useState<HwSource>('primary_school');
  const [busy, setBusy] = useState(false);
  // Bai nao dang tai tep len — de khoa nut Luu va hien "Đang tải…" dung cho
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('btvn:draft');
    if (!raw) { router.replace('/bome/them'); return; }
    const p = JSON.parse(raw) as Payload;
    setPayload(p);
    // durationMinutes / requiresVideo: ban nhap cu trong sessionStorage chua co
    setDrafts(
      p.drafts.map((d) => ({
        ...d,
        media: d.media ?? [],
        durationStr: String(d.durationMinutes ?? DURATION_DEFAULT),
        requiresVideo: d.requiresVideo ?? false,
      }))
    );
    // Ban nhap cu (truoc khi co nguon giao) khong co hwSource -> truong tieu hoc
    setHwSource(hwSourceOf(p.hwSource));
  }, [router]);

  if (!payload) return null;

  const chosenNames = kids.filter((c) => payload.childIds.includes(c.id)).map((c) => c.name);

  const patch = (i: number, k: keyof Draft, v: unknown) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, [k]: v } : d)));

  const remove = (i: number) => setDrafts((ds) => ds.filter((_, j) => j !== i));

  const addBlank = () =>
    setDrafts((ds) => [
      ...ds,
      {
        subject: 'Khác', icon: iconFor('Khác'), content: '', note: null, lang: 'vi',
        confidence: 1, media: [], durationStr: String(DURATION_DEFAULT),
        requiresVideo: false,
      },
    ]);

  /** Tai tep len va dinh vao DUNG MOT bai — vi du video phat am cho bai tieng Anh. */
  async function addMedia(i: number, files: FileList | null) {
    if (!files?.length) return;
    setUploadingIdx(i);
    setError('');
    try {
      for (const file of Array.from(files)) {
        const m = await uploadMediaFile(file, blobEnabled);
        setDrafts((ds) =>
          ds.map((d, j) => (j === i ? { ...d, media: [...(d.media ?? []), m] } : d))
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được tệp.');
    } finally {
      setUploadingIdx(null);
    }
  }

  const removeMedia = (i: number, url: string) =>
    setDrafts((ds) =>
      ds.map((d, j) => (j === i ? { ...d, media: (d.media ?? []).filter((m) => m.url !== url) } : d))
    );

  /** Gop bai nay vao bai ngay tren — AI hay tach nham mot bai thanh hai dong. */
  const mergeUp = (i: number) =>
    setDrafts((ds) =>
      ds.reduce<Draft[]>((acc, d, j) => {
        if (j === i && acc.length) {
          const prev = acc[acc.length - 1];
          // Tep dinh kem lay hop cua hai bai, khong nhan doi tep trung URL
          const media = [
            ...(prev.media ?? []),
            ...(d.media ?? []).filter((m) => !(prev.media ?? []).some((x) => x.url === m.url)),
          ];
          acc[acc.length - 1] = {
            ...prev,
            content: `${prev.content} ${d.content}`.trim(),
            media,
            // Mot trong hai nua co yeu cau quay video thi bai gop van phai quay
            requiresVideo: Boolean(prev.requiresVideo || d.requiresVideo),
          };
          return acc;
        }
        return [...acc, d];
      }, [])
    );

  async function save() {
    const clean = drafts
      .filter((d) => d.content.trim())
      .map(({ durationStr, ...d }) => ({
        ...d,
        durationMinutes: durationStr === '' ? DURATION_DEFAULT : Number(durationStr),
      }));
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
          source: hwSource,
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

      {/* Noi giao cua CA dot bai — AI chi goi y, chon o day moi la quyet dinh.
          Sau khi luu van sua duoc tung bai mot o man Sua bai tap. */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-p-label uppercase text-on-surface-variant">Bài của</span>
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

                {/* Dong ho o man cua con dem nguoc tu so nay. AI uoc 5-15 phut;
                    bo me sua tay thi duoc ghi ngoai khoang do (toi da 180). */}
                <label className="inline-flex items-center gap-1 text-p-body-sm rounded-full bg-surface-container px-3 py-1.5 text-on-surface">
                  <span className="material-symbols-outlined text-base">timer</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={180}
                    value={d.durationStr}
                    onChange={(e) => patch(i, 'durationStr', e.target.value)}
                    className="w-12 bg-transparent outline-none text-right"
                    aria-label="Thời lượng (phút)"
                  />
                  phút
                </label>

                {/* Ten sach hien tren the bai tap o man cua con nen o nay phai du
                    rong de doc duoc ca ten sach, khong chi so trang */}
                <input
                  value={d.note ?? ''}
                  onChange={(e) => patch(i, 'note', e.target.value || null)}
                  placeholder="sách, trang…"
                  className="text-p-body-sm rounded-full bg-surface-container px-3 py-1.5 text-on-surface
                             placeholder:text-outline flex-1 min-w-[10rem]"
                />

                {/* AI tu danh dau bai phai quay video (doc to, doc thuoc long...);
                    danh nham hay sot thi bo me bam chip nay de bat/tat lai */}
                <button
                  onClick={() => patch(i, 'requiresVideo', !d.requiresVideo)}
                  aria-pressed={d.requiresVideo ?? false}
                  className={`text-p-body-sm rounded-full px-3 py-1.5 border transition-colors ${
                    d.requiresVideo
                      ? 'bg-tertiary-fixed text-on-tertiary-fixed border-tertiary-fixed font-bold'
                      : 'bg-surface-container text-on-surface-variant border-transparent'
                  }`}
                >
                  🎥 {d.requiresVideo ? 'Cần quay video' : 'Không cần video'}
                </button>

                {/* Chi con ban tach tho theo dong (0.3) moi roi xuong duoi nguong */}
                {d.confidence < 0.6 && (
                  <span className="inline-flex items-center gap-1 text-p-body-sm text-error">
                    <span className="material-symbols-outlined text-base">warning</span>
                    Tách tạm, chưa qua AI
                  </span>
                )}
              </div>

              {/* Tep dinh kem cua RIENG bai nay — video phat am, ghi am mau doc,
                  anh bang chu cai... Tai o day chu khong phai man truoc, de khong
                  bao gio co chuyen video phat am dinh nham vao bai Toan. */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {(d.media ?? []).map((m) => (
                  <span
                    key={m.url}
                    className="inline-flex items-center gap-1 text-p-body-sm rounded-full pl-3 pr-1 py-1
                               bg-tertiary-fixed text-on-tertiary-fixed max-w-full"
                  >
                    <span className="material-symbols-outlined text-base shrink-0">{MEDIA_ICON[m.kind]}</span>
                    <span className="truncate">{m.name}</span>
                    <button
                      onClick={() => removeMedia(i, m.url)}
                      className="min-h-p-tap px-1 flex items-center"
                      aria-label={`Bỏ tệp ${m.name}`}
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </span>
                ))}
                <label
                  className="inline-flex items-center gap-1 text-p-body-sm rounded-full px-3 py-1.5
                             border border-dashed border-outline-variant text-on-surface-variant cursor-pointer"
                >
                  <input
                    type="file"
                    accept={MEDIA_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addMedia(i, e.target.files);
                      e.target.value = ''; // chon lai cung mot tep van phai chay
                    }}
                  />
                  <span className="material-symbols-outlined text-base">attach_file</span>
                  {uploadingIdx === i ? 'Đang tải…' : 'Video / ghi âm / ảnh'}
                </label>
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
          disabled={busy || uploadingIdx !== null}
          className="flex-[2] flex items-center justify-center gap-2 bg-success text-white rounded-card
                     h-14 min-h-p-tap text-p-body font-bold card-shadow disabled:opacity-60"
        >
          {busy ? 'Đang lưu…' : `Lưu ${drafts.length} bài tập`}
        </button>
      </div>
    </main>
  );
}
