'use client';

import { useEffect, useRef, useState } from 'react';
import { MAX_QUAY_GIAY, uploadSubmissionVideo } from '@/lib/media';

/**
 * Quay video nop bai — cho bai co requiresVideo (doc to, doc thuoc long, quay
 * gui co...). Hai duong quay, chon theo kha nang cua may:
 *
 *   1. Quay NGAY TRONG TRANG bang getUserMedia + MediaRecorder — co khung xem
 *      truoc, quay lai, roi moi gui. Day la duong chinh: Safari tren iPadOS ho
 *      tro MediaRecorder tu 14.5 (ghi ra video/mp4, H.264 — KHONG ho tro webm),
 *      Chrome/Edge ghi ra video/webm. Vi the mimeType phai do isTypeSupported
 *      tung ung vien mp4 truoc webm sau, khong duoc ghi cung.
 *
 *   2. May khong co MediaRecorder / con tu choi quyen camera -> <input
 *      type="file" accept="video/*" capture="user"> mo may quay CUA HE DIEU
 *      HANH (tren iPad la app Camera), quay xong tra tep ve. Duong nay gan nhu
 *      khong the hong nen luon hien song song lam loi thoat.
 *
 * Do dai chan o MAX_QUAY_GIAY (3 phut): du doc mot bai tho dai, va o bitrate
 * ~1.5Mbps thi tep ≈ 35MB, tai noi tren mang nha. May tu dung quay khi het gio.
 */

type Phase = 'idle' | 'recording' | 'preview' | 'sending';

/** mp4 truoc (Safari chi ghi duoc mp4), webm sau (Chrome/Firefox). */
const MIME_UU_TIEN = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function QuayVideo({
  existingUrl,
  blobEnabled,
  onSubmit,
}: {
  /** Video da nop truoc do (neu co) — hien lai de con xem va quay lai duoc. */
  existingUrl: string | null;
  blobEnabled: boolean;
  /** Duoc goi voi URL video sau khi tai len xong; ben ngoai lo PATCH + man khen. */
  onSubmit: (url: string) => Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  // null = chua biet (truoc khi mount); tinh sau mount de SSR/khach khop nhau
  const [canRecord, setCanRecord] = useState<boolean | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState('');
  // Dang xin quyen camera: nut phai mo ngay de con khong bam hai lan
  const [starting, setStarting] = useState(false);

  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const blobUrlRef = useRef('');
  const startingRef = useRef(false);

  useEffect(() => {
    setCanRecord(
      typeof MediaRecorder !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia)
    );
  }, []);

  /**
   * Doi ban xem truoc, tha URL cu di. Phai giu qua ref: ban clip 3 phut nang
   * ~35MB, tha muon (hoac khong tha khi roi trang) thi no nam lai het phien.
   */
  function setPreviewUrl(url: string) {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = url;
    setBlobUrl(url);
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  // Roi trang giua chung thi tat camera va tha bo nho cua ban xem truoc
  useEffect(() => () => {
    startingRef.current = false;   // getUserMedia dang cho se tu tat luong
    stopStream();
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = ''; }
  }, []);

  /* Gan luong camera vao khung xem truoc SAU khi React da ve the <video> —
     gan ngay trong start() thi thua: luc do the con chua ton tai (state vua
     doi, chua commit) va khung hinh se den thui. */
  useEffect(() => {
    if (phase === 'recording' && liveRef.current && streamRef.current) {
      liveRef.current.srcObject = streamRef.current;
      liveRef.current.play().catch(() => {}); // autoPlay+muted thuong tu chay, day chi la day them
    }
  }, [phase]);

  async function start() {
    // Con bam hai lan trong luc bang xin quyen con mo -> hai MediaStream, cai
    // sau de len streamRef va cai truoc khong ai tat duoc nua (camera cu sang).
    if (startingRef.current || phase !== 'idle') return;
    startingRef.current = true;
    setStarting(true);
    setError('');
    setPreviewUrl('');
    setBlob(null);

    let stream: MediaStream;
    try {
      // Camera truoc + do phan giai vua phai: con tu quay minh doc bai, khong
      // can 4K — tep nho thi gui nhanh, iPad cu cung ghi kip.
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
        audio: true,
      });
    } catch {
      // Con bam "Không cho phép" hoac camera dang bi app khac giu — chi con
      // duong may quay cua he dieu hanh.
      startingRef.current = false;
      setStarting(false);
      setError('Chưa mở được máy quay. Con thử nút "Quay bằng máy ảnh" bên dưới nhé.');
      return;
    }

    // Trong luc cho quyen, con da quay bang app Camera (onPickFile) hoac roi
    // trang — bo luong vua mo, khong duoc de no de mat tep con vua chon.
    if (!startingRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    startingRef.current = false;
    setStarting(false);

    streamRef.current = stream;
    chunksRef.current = [];
    discardRef.current = false;

    const mime = MIME_UU_TIEN.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: 1_500_000,
      });
    } catch {
      stopStream();
      setError('Máy này chưa quay trong trang được. Con dùng nút "Quay bằng máy ảnh" nhé.');
      return;
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      stopStream();
      if (discardRef.current) { setPhase('idle'); return; }
      const out = new Blob(chunksRef.current, { type: recorder.mimeType || mime || 'video/mp4' });
      if (out.size === 0) {
        setError('Chưa quay được gì, con thử lại nhé.');
        setPhase('idle');
        return;
      }
      setBlob(out);
      setPreviewUrl(URL.createObjectURL(out));
      setPhase('preview');
    };

    elapsedRef.current = 0;
    setElapsed(0);
    setPhase('recording');   // useEffect [phase] o tren se gan srcObject sau khi ve

    recorder.start();
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= MAX_QUAY_GIAY) stopRecording(false); // het gio -> tu dung
    }, 1000);
  }

  function stopRecording(discard: boolean) {
    discardRef.current = discard;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const r = recorderRef.current;
    if (r && r.state !== 'inactive') r.stop();
    else { stopStream(); if (discard) setPhase('idle'); }
  }

  /** Duong lui: video quay bang app Camera cua may (hoac chon tu thu vien). */
  function onPickFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError('');
    if (!file.type.startsWith('video/')) { setError('Tệp này không phải video.'); return; }
    // Huy lan xin quyen camera dang cho (neu co) de no khong de mat tep nay
    startingRef.current = false;
    setStarting(false);
    setBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPhase('preview');
  }

  async function send() {
    if (!blob) return;
    setPhase('sending');
    setError('');
    try {
      const duoi = blob.type.includes('webm') ? 'webm' : 'mp4';
      const file = blob instanceof File
        ? blob
        : new File([blob], `quay-${Date.now()}.${duoi}`, { type: blob.type });
      const url = await uploadSubmissionVideo(file, blobEnabled);
      await onSubmit(url);
      // Thanh cong: ben ngoai hien man khen va chuyen trang; don ban xem truoc
      setPreviewUrl('');
      setBlob(null);
      setPhase('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa gửi được video. Con thử lại nhé!');
      setPhase('preview');
    }
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <p className="flex items-center gap-3 text-k-headline text-on-background">
        <span className="material-symbols-outlined text-4xl text-error icon-fill">videocam</span>
        Quay video nộp bài
      </p>

      {/* ---- Dang quay: khung hinh truc tiep + dong ho + nut dung ---- */}
      {phase === 'recording' && (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <video
              ref={liveRef}
              muted
              playsInline
              autoPlay
              className="w-full max-h-[50vh] rounded-3xl soft-shadow bg-black -scale-x-100"
            />
            <span className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 text-white
                             rounded-full px-4 py-2 text-k-body-sm font-bold">
              <span className="w-3 h-3 rounded-full bg-error animate-pulse" />
              {mmss(elapsed)} / {mmss(MAX_QUAY_GIAY)}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => stopRecording(false)}
              className="btn-3d-primary bg-error text-white rounded-3xl flex items-center
                         justify-center gap-3 px-6 h-20 flex-[2]"
            >
              <span className="material-symbols-outlined text-4xl icon-fill">stop_circle</span>
              <span className="text-k-headline">Quay xong</span>
            </button>
            <button
              onClick={() => stopRecording(true)}
              className="rounded-3xl border-4 border-outline-variant text-on-surface-variant
                         flex items-center justify-center px-6 h-20 flex-1 text-k-body"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* ---- Xem lai truoc khi gui: quay lai duoc, ung roi moi gui ---- */}
      {(phase === 'preview' || phase === 'sending') && blobUrl && (
        <div className="flex flex-col gap-4">
          <video
            src={blobUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[50vh] rounded-3xl soft-shadow bg-black"
          />
          <div className="flex gap-3">
            <button
              onClick={send}
              disabled={phase === 'sending'}
              className="btn-3d-success text-white rounded-3xl flex items-center justify-center
                         gap-3 px-6 h-20 flex-[2] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-4xl icon-fill">send</span>
              <span className="text-k-headline whitespace-nowrap">
                {phase === 'sending' ? 'Đang gửi…' : 'Gửi bài'}
              </span>
            </button>
            <button
              onClick={() => {
                setPreviewUrl(''); setBlob(null); setPhase('idle');
              }}
              disabled={phase === 'sending'}
              className="rounded-3xl border-4 border-outline-variant text-on-surface-variant
                         flex items-center justify-center px-6 h-20 flex-1 text-k-body disabled:opacity-60"
            >
              Quay lại
            </button>
          </div>
        </div>
      )}

      {/* ---- Chua quay: video da nop (neu co) + nut quay ---- */}
      {phase === 'idle' && (
        <div className="flex flex-col gap-4">
          {existingUrl && (
            <div className="flex flex-col gap-2">
              <p className="text-k-body-sm text-on-surface-variant">Video con đã gửi:</p>
              <video
                src={existingUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full max-h-[40vh] rounded-3xl soft-shadow bg-black"
              />
            </div>
          )}

          {canRecord && (
            <button
              onClick={start}
              disabled={starting}
              className="btn-3d-primary bg-tertiary text-on-tertiary rounded-3xl flex items-center
                         justify-center gap-4 px-6 h-20 w-full disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-4xl icon-fill">videocam</span>
              <span className="text-k-headline">
                {starting ? 'Đang mở máy quay…' : existingUrl ? 'Quay video khác' : 'Bắt đầu quay'}
              </span>
            </button>
          )}

          {/* Loi thoat luon co mat: mo may quay cua he dieu hanh. Tren iPad
              capture="user" mo thang app Camera voi camera truoc. May khong
              quay trong trang duoc thi day thanh nut chinh. */}
          {canRecord !== null && (
            <label
              className={`rounded-3xl flex items-center justify-center gap-4 px-6 h-20 w-full cursor-pointer
                          ${canRecord
                            ? 'border-4 border-dashed border-outline-variant text-on-surface-variant text-k-body'
                            : 'btn-3d-primary bg-tertiary text-on-tertiary text-k-headline'}`}
            >
              <input
                type="file"
                accept="video/*"
                capture="user"
                className="hidden"
                onChange={(e) => { onPickFile(e.target.files); e.target.value = ''; }}
              />
              <span className="material-symbols-outlined text-4xl icon-fill">photo_camera</span>
              <span>{canRecord ? 'Hoặc quay bằng máy ảnh' : existingUrl ? 'Quay video khác' : 'Quay bằng máy ảnh'}</span>
            </label>
          )}
        </div>
      )}

      {error && <p className="text-k-body-sm text-error">{error}</p>}
    </div>
  );
}
