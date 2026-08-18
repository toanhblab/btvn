'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Assignment } from '@/lib/types';

/**
 * Chi tiet mot bai — nen tu Stitch 07.
 *
 * Nut "Nghe de bai" la tinh nang BAT BUOC chu khong phai phu: be 4 tuoi chua doc
 * duoc chu nao nen day gan nhu la cach duy nhat de biet phai lam gi (PRD muc 3).
 */
export default function ChiTietBai({
  assignment,
  childId,
  celebrate,
}: {
  assignment: Assignment;
  childId: string;
  celebrate: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(assignment.status === 'done');
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [voiceWarning, setVoiceWarning] = useState('');

  const wantLang = assignment.lang === 'en' ? 'en' : 'vi';

  /* Safari tra danh sach giong rong o lan goi dau -> nghe them su kien voiceschanged */
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setVoiceWarning('Thiết bị này không đọc được đề bài thành tiếng.');
      return;
    }
    const check = () => {
      const has = speechSynthesis
        .getVoices()
        .some((v) => v.lang.toLowerCase().startsWith(wantLang));
      setVoiceWarning(
        has
          ? ''
          : wantLang === 'en'
            ? 'Máy chưa có giọng tiếng Anh. Bố mẹ vào Cài đặt → Trợ năng → Nội dung đọc để tải thêm giọng.'
            : 'Máy chưa có giọng tiếng Việt. Bố mẹ vào Cài đặt → Trợ năng → Nội dung đọc để tải giọng vi-VN.'
      );
    };
    check();
    speechSynthesis.addEventListener('voiceschanged', check);
    return () => speechSynthesis.removeEventListener('voiceschanged', check);
  }, [wantLang]);

  // Dung doc khi roi man, khong thi giong con vang theo sang trang khac
  useEffect(() => () => speechSynthesis?.cancel(), []);

  function speak() {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();             // tre hay bam lien tuc -> chan doc chong nhau
    const u = new SpeechSynthesisUtterance(assignment.content);
    u.lang = assignment.lang === 'en' ? 'en-US' : 'vi-VN';
    u.rate = 0.85;                        // cham lai cho tre nghe kip
    const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(wantLang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  async function setStatus(nextDone: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/assignments/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextDone ? 'done' : 'todo' }),
      });
      if (!res.ok) throw new Error();
      setDone(nextDone);
      if (nextDone) setShowSuccess(true);
      else router.push(`/con/${childId}`);
    } catch {
      alert('Chưa lưu được. Con thử lại nhé!');
    } finally {
      setSaving(false);
    }
  }

  function afterSuccess() {
    setShowSuccess(false);
    // Xong bai cuoi cung cua hom nay -> man chuc mung, con lai thi ve danh sach
    router.push(celebrate ? `/con/${childId}/xong` : `/con/${childId}`);
    router.refresh();
  }

  return (
    <main className="kid-scope h-screen flex flex-col p-k-edge overflow-hidden">
      <div className="mb-k-stack shrink-0">
        <Link
          href={`/con/${childId}`}
          className="inline-flex items-center gap-2 text-on-surface-variant hover:bg-surface-container
                     rounded-full pr-4 py-2 min-h-k-tap"
        >
          <span className="material-symbols-outlined text-4xl icon-fill">arrow_back_ios_new</span>
          <span className="text-k-headline">Quay lại</span>
        </Link>
      </div>

      {/* Khong con anh de bai: anh minh hoa khong giup con hieu them nen chi choan cho */}
      <section className="flex-1 w-full max-w-3xl mx-auto flex flex-col justify-between min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-k-stack">
          <div className="self-start px-6 py-3 bg-tertiary-fixed rounded-full soft-shadow">
            <span className="text-k-headline text-on-tertiary-fixed">
              {assignment.icon} {assignment.subject}
            </span>
          </div>

          <h1 className="text-k-headline text-on-background">{assignment.content}</h1>
          {assignment.note && (
            <p className="text-k-body-sm text-on-surface-variant">{assignment.note}</p>
          )}

          <button
            onClick={speak}
            className="btn-3d-primary bg-primary text-on-primary rounded-3xl flex items-center
                       justify-center gap-4 px-6 h-20 w-full mt-2"
          >
            <span className="material-symbols-outlined text-4xl">volume_up</span>
            <span className="text-k-headline">Nghe đề bài</span>
          </button>
          {voiceWarning && <p className="text-k-body-sm text-error">{voiceWarning}</p>}
        </div>

        <div className="flex flex-col items-center gap-4 mt-6 shrink-0">
          {!done ? (
            <button
              onClick={() => setStatus(true)}
              disabled={saving}
              className="btn-3d-success text-white rounded-[32px] flex items-center justify-center
                         gap-4 px-8 h-24 w-full disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-5xl icon-fill">check_circle</span>
              <span className="text-k-headline whitespace-nowrap">Đã làm xong</span>
            </button>
          ) : (
            // Tick nham phai bo duoc (PRD 4.3)
            <button
              onClick={() => setStatus(false)}
              disabled={saving}
              className="text-k-body text-outline hover:text-on-surface-variant p-4 min-h-k-tap disabled:opacity-60"
            >
              Chưa làm xong
            </button>
          )}
        </div>
      </section>

      {showSuccess && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-k-edge">
          <div className="bg-white rounded-[40px] p-12 flex flex-col items-center gap-8 soft-shadow">
            <span className="material-symbols-outlined text-[120px] text-success icon-fill animate-bounce">
              star
            </span>
            <h2 className="text-k-hero text-on-background">Giỏi quá!</h2>
            <button
              onClick={afterSuccess}
              className="btn-3d-primary bg-primary text-on-primary rounded-3xl px-12 h-20 text-k-headline"
            >
              Tiếp tục
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
