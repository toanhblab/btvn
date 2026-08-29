'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Assignment, Lang } from '@/lib/types';
import { pickVoice, splitSpeech } from '@/lib/speech';
import Confetti from '../../xong/Confetti';
import DongHoLamBai, { conThoiGian, noi, xoaDongHo } from './DongHoLamBai';
import QuayVideo from './QuayVideo';
import QuetQR from './QuetQR';

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
  blobEnabled,
}: {
  assignment: Assignment;
  childId: string;
  celebrate: boolean;
  blobEnabled: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(assignment.status === 'done');
  const [videoUrl, setVideoUrl] = useState(assignment.submittedVideoUrl);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // Xong khi dong ho van con gio -> ban confetti + loi khen (an mung, khong bat buoc)
  const [xongSom, setXongSom] = useState(false);
  const [voiceWarning, setVoiceWarning] = useState('');

  /* De hay tron hai thu tieng ("Viết các từ: apple, banana") -> tach thanh doan
     vi/en, moi doan doc bang dung giong; tu tieng Anh phat am chuan cho be hoc theo. */
  const segments = useMemo(
    () => splitSpeech(assignment.content, assignment.lang === 'en' ? 'en' : 'vi'),
    [assignment.content, assignment.lang]
  );
  const neededLangs = useMemo(
    () => [...new Set(segments.map((s) => s.lang))] as Lang[],
    [segments]
  );

  /* Safari tra danh sach giong rong o lan goi dau -> nghe them su kien voiceschanged */
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setVoiceWarning('Thiết bị này không đọc được đề bài thành tiếng.');
      return;
    }
    const check = () => {
      const voices = speechSynthesis.getVoices();
      const missing = neededLangs.filter(
        (lang) => !voices.some((v) => v.lang.toLowerCase().startsWith(lang))
      );
      setVoiceWarning(
        missing.length === 0
          ? ''
          : missing.includes('en')
            ? 'Máy chưa có giọng tiếng Anh. Bố mẹ vào Cài đặt → Trợ năng → Nội dung đọc để tải thêm giọng.'
            : 'Máy chưa có giọng tiếng Việt. Bố mẹ vào Cài đặt → Trợ năng → Nội dung đọc để tải giọng vi-VN.'
      );
    };
    check();
    speechSynthesis.addEventListener('voiceschanged', check);
    return () => speechSynthesis.removeEventListener('voiceschanged', check);
  }, [neededLangs]);

  // Dung doc khi roi man, khong thi giong con vang theo sang trang khac
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function speak() {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();             // tre hay bam lien tuc -> chan doc chong nhau
    const voices = speechSynthesis.getVoices();
    for (const seg of segments) {
      const u = new SpeechSynthesisUtterance(seg.text);
      // en-GB de khi khong tim duoc giong cu the, engine van nghieng ve giong Anh-Anh
      u.lang = seg.lang === 'en' ? 'en-GB' : 'vi-VN';
      u.rate = 0.85;                      // cham lai cho tre nghe kip
      const v = pickVoice(voices, seg.lang);
      if (v) u.voice = v;
      speechSynthesis.speak(u);           // hang doi tu dong doc noi tiep nhau
    }
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
      if (nextDone) {
        // Con gio tren dong ho -> an mung xong som; dong ho da xong viec thi xoa
        const som = conThoiGian(assignment.id, assignment.durationMinutes);
        xoaDongHo(assignment.id);
        setXongSom(som);
        if (som) {
          window.speechSynthesis?.cancel();   // cat cau nhac dang doc do, uu tien loi khen
          noi('Giỏi quá! Con làm xong sớm luôn!');
        }
        setShowSuccess(true);
      } else router.push(`/con/${childId}`);
    } catch {
      alert('Chưa lưu được. Con thử lại nhé!');
    } finally {
      setSaving(false);
    }
  }

  /**
   * Con gui video nop bai: luu URL va danh dau xong LUON trong mot lan goi —
   * voi bai phai quay video thi gui video chinh la "lam xong", khong bat con
   * tick them mot nut nua. Nem loi ra cho QuayVideo hien, khong alert o day.
   */
  async function nopVideo(url: string) {
    const res = await fetch(`/api/assignments/${assignment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: url, status: 'done' }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? 'Chưa gửi được video. Con thử lại nhé!');
    }
    setVideoUrl(url);
    setDone(true);
    // Gui video la lam xong bai -> dong ho cung phai dung, y nhu duong tick
    const som = conThoiGian(assignment.id, assignment.durationMinutes);
    xoaDongHo(assignment.id);
    setXongSom(som);
    if (som) {
      window.speechSynthesis?.cancel();
      noi('Giỏi quá! Con làm xong sớm luôn!');
    }
    setShowSuccess(true);
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
        {/* Vung bam phai du 64px CA HAI CHIEU (chuan cham cua man con): truoc day
            chi co dem ben phai nen nua trai mui ten khong an duoc — ngon tay tre
            cham lech sang trai la truot ra ngoai the <a>. */}
        <Link
          href={`/con/${childId}`}
          className="inline-flex items-center gap-2 text-on-surface-variant hover:bg-surface-container
                     rounded-full px-4 py-2 min-h-k-tap min-w-k-tap"
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
            <p className="flex items-center gap-2 text-k-body-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-2xl shrink-0">menu_book</span>
              {assignment.note}
            </p>
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

          {/* To bai tap giay hay in ma QR (bai nghe cua nha xuat ban...). Quet
              ngay tai day de con khong phai muon dien thoai bo me giua buoi hoc. */}
          <QuetQR />

          {/* Dong ho lam bai: nut "Bat dau lam" -> dem nguoc + nhac giong noi.
              Bai da xong thi thoi, khong can gio giac gi nua. */}
          {!done && (
            <DongHoLamBai assignmentId={assignment.id} minutes={assignment.durationMinutes} />
          )}

          {/* Tep bo me dinh kem — video luyen phat am, ghi am co doc mau, anh bang
              chu cai... Nut play cua trinh duyet du to cho tre, chi can khung ro
              rang va nhan de hieu; anh thi hien thang ra, khong bat bam gi ca. */}
          {assignment.media.length > 0 && (
            <div className="flex flex-col gap-4 mt-2">
              <p className="flex items-center gap-3 text-k-headline text-on-background">
                <span className="material-symbols-outlined text-4xl text-tertiary icon-fill">
                  attach_file
                </span>
                Cô gửi kèm bài này
              </p>
              {assignment.media.map((m) =>
                m.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={m.url}
                    src={m.url}
                    alt=""
                    className="w-full max-h-[60vh] object-contain rounded-3xl soft-shadow
                               bg-surface-container"
                  />
                ) : m.kind === 'audio' ? (
                  <div
                    key={m.url}
                    className="bg-surface-container rounded-3xl soft-shadow p-5 flex items-center gap-4"
                  >
                    <span className="material-symbols-outlined text-5xl text-tertiary icon-fill shrink-0">
                      music_note
                    </span>
                    <audio src={m.url} controls preload="metadata" className="w-full" />
                  </div>
                ) : (
                  <video
                    key={m.url}
                    src={m.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-[50vh] rounded-3xl soft-shadow bg-black"
                  />
                )
              )}
            </div>
          )}

          {/* Bai phai quay video: khung quay/nop nam ngay trong noi dung bai.
              Gui video xong la bai tu chuyen sang "da lam xong" (nopVideo). */}
          {assignment.requiresVideo && (
            <QuayVideo existingUrl={videoUrl} blobEnabled={blobEnabled} onSubmit={nopVideo} />
          )}
        </div>

        <div className="flex flex-col items-center gap-4 mt-6 shrink-0">
          {!done && assignment.requiresVideo && !videoUrl ? (
            // Chua co video thi khong co nut tick: quay video chinh la cach
            // hoan thanh bai nay (server cung chan tick suong).
            <p className="flex items-center gap-2 text-k-body-sm text-on-surface-variant text-center">
              <span className="material-symbols-outlined text-2xl">videocam</span>
              Quay video xong là hoàn thành bài này
            </p>
          ) : !done ? (
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
          {/* Xong truoc khi het gio -> mua confetti sau tam chuc mung.
              Tam phai co position de confetti (canvas fixed) roi PHIA SAU chu. */}
          {xongSom && <Confetti />}
          <div className="relative bg-white rounded-[40px] p-12 flex flex-col items-center gap-8 soft-shadow">
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
