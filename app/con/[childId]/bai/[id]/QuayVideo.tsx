'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MAX_QUAY_GIAY,
  QUAY_AUDIO_BPS,
  QUAY_VIDEO_BPS,
  uploadSubmissionVideo,
} from '@/lib/media';
import {
  CAU_BAO_KET_THUC,
  CAU_BAO_MO_CAMERA,
  hoTroNhipKhung,
  noiNhipKhung,
  phanLoaiLoiMoCamera,
  taoPhienQuay,
  type PhienQuay,
} from '@/lib/phienQuay';
import { useT } from '@/lib/i18n/client';

/**
 * Quay video nop bai — cho bai co requiresVideo (doc to, doc thuoc long, quay
 * gui co...). MOT duong quay duy nhat: NGAY TRONG TRANG bang getUserMedia +
 * MediaRecorder — co khung xem truoc, quay lai, roi moi gui. Safari tren
 * iPadOS/macOS ghi ra video/mp4 (H.264 — KHONG ho tro webm), Chrome/Edge ghi ra
 * video/webm; mimeType do isTypeSupported tung ung vien (lib/phienQuay.ts).
 *
 * Duong lui "quay bang may anh cua he dieu hanh" (<input capture>) DA BO theo
 * quyet dinh cua captain (#51): con luon dung iPad hoac MacBook, khong co
 * truong hop thieu camera. Vi the mo camera THAT BAI phai ra cau bao con doc
 * duoc va noi ro phai lam gi (CAU_BAO_MO_CAMERA) — do la luoi an toan duy nhat.
 *
 * Vong doi ghi (dong ho, dung/huy, ghep Blob, va thoi luong) va bo canh LUONG
 * DUNG giua buoi quay (#51 — tu dung, KHONG luu, bao con quay lai) nam trong
 * lib/phienQuay.ts, doc chu thich dau tep do truoc khi dung vao luong quay.
 *
 * Do dai chan o MAX_QUAY_GIAY (10 phut) va may TU DUNG quay khi het gio. Muc
 * nen di kem la QUAY_VIDEO_BPS + QUAY_AUDIO_BPS, hai so do chon cung nhau: 10
 * phut o muc do ra tep ≈ 82MB (xem lib/media). Doi mot trong hai ma khong doi
 * cai kia la tep phinh qua tran MAX_NOP_VIDEO_BYTES.
 */

/**
 * 'ready' = camera da mo, khung hinh truc tiep da hien nhung CHUA ghi gi: con
 * nhin thay minh, chinh lai cho ngoi, roi moi bam "Bắt đầu quay". Dong ho va
 * moc MAX_QUAY_GIAY chi chay tu luc sang 'recording'.
 */
type Phase = 'idle' | 'ready' | 'recording' | 'preview' | 'sending';

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
  const T = useT();
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState('');
  // Dang xin quyen camera: nut phai mo ngay de con khong bam hai lan
  const [starting, setStarting] = useState(false);
  // null = chua/khong do duoc tien do (duong dev, hoac dang lam lai PATCH) ->
  // chi hien vong xoay, TUYET DOI khong bia so phan tram cho con doc
  const [phanTram, setPhanTram] = useState<number | null>(null);

  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Phien ghi dang chay (chi khac null o phase 'recording'). */
  const phienRef = useRef<PhienQuay | null>(null);
  /** Go nhip khung rVFC khoi khung xem truoc khi phien ket thuc. */
  const goNhipKhungRef = useRef<() => void>(() => {});
  const blobUrlRef = useRef('');
  /** Ban da tai len xong roi (kem chinh Blob no den tu) — de gui lai khong tai lai. */
  const uploadedRef = useRef<{ blob: Blob; url: string } | null>(null);
  const startingRef = useRef(false);

  /**
   * Doi ban xem truoc, tha URL cu di. Phai giu qua ref: ban clip 10 phut nang
   * ~82MB, tha muon (hoac khong tha khi roi trang) thi no nam lai het phien.
   */
  function setPreviewUrl(url: string) {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = url;
    setBlobUrl(url);
  }

  /**
   * Doi ban quay hien tai. Phai di qua day chu khong goi setBlob truc tiep: doi
   * ban quay la bo hieu luc URL da tai len, khong bo thi lan gui sau se dinh kem
   * URL cua ban quay CU.
   */
  function setClip(b: Blob | null) {
    uploadedRef.current = null;
    setBlob(b);
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Roi trang giua chung thi tat camera va tha bo nho cua ban xem truoc
  useEffect(() => () => {
    startingRef.current = false;   // getUserMedia dang cho se tu tat luong
    // Phien dang ghi thi bo hang (khong goi onKetThuc): khong thi no dung mot
    // object URL sau khi don xong.
    phienRef.current?.boRoi();
    phienRef.current = null;
    goNhipKhungRef.current();
    stopStream();
    uploadedRef.current = null;
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = ''; }
  }, []);

  /* Gan luong camera vao khung xem truoc SAU khi React da ve the <video> —
     gan ngay trong moCamera() thi thua: luc do the con chua ton tai (state vua
     doi, chua commit) va khung hinh se den thui.
     Cung o day luon, khi vua sang 'ready': cuon khung hinh vao giua man. Tren
     iPad ngang khung nam duoi de bai nen con khong thay minh neu khong cuon. */
  useEffect(() => {
    if ((phase === 'ready' || phase === 'recording') && liveRef.current && streamRef.current) {
      liveRef.current.srcObject = streamRef.current;
      liveRef.current.play().catch(() => {}); // autoPlay+muted thuong tu chay, day chi la day them
      if (phase === 'ready') cuonToiKhung();
    }
  }, [phase]);

  /* Cuon lan hai o onLoadedMetadata la CAN, khong phai cho chac: luc effect
     tren chay, the <video> chua biet kich thuoc luong nen con thap; cuon xong
     no moi gian ra theo ti le 4:3 va day chinh no xuong duoi khung nhin. */
  function cuonToiKhung() {
    liveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Nhip 1: chi MO may quay roi dung o 'ready'. Chua tao MediaRecorder, chua
   * chay dong ho — con nhin thay minh trong khung truoc da.
   */
  async function moCamera() {
    // Con bam hai lan trong luc bang xin quyen con mo -> hai MediaStream, cai
    // sau de len streamRef va cai truoc khong ai tat duoc nua (camera cu sang).
    if (startingRef.current || phase !== 'idle') return;
    startingRef.current = true;
    setStarting(true);
    setError('');
    setPreviewUrl('');
    setClip(null);

    // Khong con duong lui nao khac, nen may thieu MediaRecorder/getUserMedia
    // cung phai ra cau con doc duoc, khong duoc im.
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      startingRef.current = false;
      setStarting(false);
      setError(T(CAU_BAO_KET_THUC['khong-ghi-duoc']));
      return;
    }

    let stream: MediaStream;
    try {
      // Camera truoc + do phan giai vua phai: con tu quay minh doc bai, khong
      // can 4K — tep nho thi gui nhanh, iPad cu cung ghi kip.
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
        audio: true,
      });
    } catch (loi) {
      // Con bam "Không cho phép", may khong co camera, hoac camera dang bi app
      // khac giu — moi ca mot cau rieng noi ro phai lam gi (lib/phienQuay.ts).
      startingRef.current = false;
      setStarting(false);
      setError(T(CAU_BAO_MO_CAMERA[phanLoaiLoiMoCamera(loi)]));
      return;
    }

    // Trong luc cho quyen, con da roi trang — bo luong vua mo, khong de camera
    // sang mai ma khong ai tat duoc.
    if (!startingRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    startingRef.current = false;
    setStarting(false);

    streamRef.current = stream;
    setElapsed(0);
    setPhase('ready');   // useEffect [phase] o tren gan srcObject + cuon toi khung
  }

  /** Thoat o giai doan 'ready': tat sach luong, ve man cho. */
  function dongCamera() {
    stopStream();
    setPhase('idle');
  }

  /**
   * Nhip 2: con bam "Bắt đầu quay" trong khung — gio moi tao phien ghi
   * (MediaRecorder + dong ho + bo canh luong dung) va chay tu 0:00.
   */
  function batDauGhi() {
    const stream = streamRef.current;
    if (phase !== 'ready' || !stream) return;

    const phien = taoPhienQuay({
      stream,
      theoDoiKhung: hoTroNhipKhung(liveRef.current),
      videoBitsPerSecond: QUAY_VIDEO_BPS,
      audioBitsPerSecond: QUAY_AUDIO_BPS,
      maxGiay: MAX_QUAY_GIAY,
      onGiay: setElapsed,
      onKetThuc: (kq) => {
        goNhipKhungRef.current();
        goNhipKhungRef.current = () => {};
        phienRef.current = null;
        streamRef.current = null; // phien da tat het track
        if (kq.lyDo === 'xong') {
          setClip(kq.clip);
          setPreviewUrl(URL.createObjectURL(kq.clip));
          setPhase('preview');
          return;
        }
        // Huy: ve man cho, khong noi gi. Con lai (trong / gian doan / khong ghi
        // duoc): ve man cho + cau bao — nut "Mở máy quay" van o do, con quay lai
        // ngay khong phai tai lai trang.
        if (kq.lyDo !== 'huy') setError(T(CAU_BAO_KET_THUC[kq.lyDo]));
        setPhase('idle');
      },
    });
    phienRef.current = phien;
    setElapsed(0);
    // Phai start XONG roi moi doi phase, khong thi man hinh quay ket lai.
    // That bai thi onKetThuc o tren da nhan 'khong-ghi-duoc' va ve 'idle'.
    if (!phien.batDau()) return;
    if (liveRef.current) goNhipKhungRef.current = noiNhipKhung(liveRef.current, phien);
    setPhase('recording');
  }

  function stopRecording(discard: boolean) {
    phienRef.current?.dung(discard);
  }

  async function send() {
    if (!blob) return;
    setPhase('sending');
    setPhanTram(null);
    setError('');
    try {
      // Lan truoc tai len xong roi ma PATCH moi hong thi chi lam lai PATCH: tai
      // lai la de thanh mot ban 82-600MB mo vang tren Blob, khong ai tro toi va
      // phia con khong co duong xoa.
      let url = uploadedRef.current?.blob === blob ? uploadedRef.current.url : '';
      if (!url) {
        // Clip chi con den tu MediaRecorder (MIME_UU_TIEN: mp4 hoac webm), nen
        // "khong phai webm thi la mp4" la dung, khong con tep .mov tu may anh.
        const duoi = blob.type.includes('webm') ? 'webm' : 'mp4';
        const file = new File([blob], `quay-${Date.now()}.${duoi}`, { type: blob.type });
        url = await uploadSubmissionVideo(file, blobEnabled, setPhanTram, T);
        uploadedRef.current = { blob, url };
      }
      await onSubmit(url);
      // Thanh cong: ben ngoai hien man khen va chuyen trang; don ban xem truoc
      setPreviewUrl('');
      setClip(null);
      setPhase('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : T('Chưa gửi được video. Con thử lại nhé!'));
      setPhase('preview');
    }
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <p className="flex items-center gap-3 text-k-headline text-on-background">
        <span className="material-symbols-outlined text-4xl text-error icon-fill">videocam</span>
        {T('Quay video nộp bài')}
      </p>

      {/* ---- Da mo may quay: MOT khoi khung hinh dung chung cho 'ready' va
           'recording'. Khong duoc tach thanh hai khoi <video> rieng: React se
           thao the ra gan lai khi doi phase, srcObject mat va khung den thui. */}
      {(phase === 'ready' || phase === 'recording') && (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <video
              ref={liveRef}
              muted
              playsInline
              autoPlay
              onLoadedMetadata={() => { if (phase === 'ready') cuonToiKhung(); }}
              className="w-full max-h-[50vh] rounded-3xl soft-shadow bg-black -scale-x-100"
            />
            {phase === 'recording' && (
              <span className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 text-white
                               rounded-full px-4 py-2 text-k-body-sm font-bold">
                <span className="w-3 h-3 rounded-full bg-error animate-pulse" />
                {mmss(elapsed)} / {mmss(MAX_QUAY_GIAY)}
              </span>
            )}
          </div>

          {phase === 'ready' ? (
            <div className="flex gap-3">
              <button
                onClick={batDauGhi}
                className="btn-3d-primary bg-error text-white rounded-3xl flex items-center
                           justify-center gap-3 px-6 h-20 flex-[2]"
              >
                <span className="material-symbols-outlined text-4xl icon-fill">radio_button_checked</span>
                <span className="text-k-headline">{T('Bắt đầu quay')}</span>
              </button>
              <button
                onClick={dongCamera}
                className="rounded-3xl border-4 border-outline-variant text-on-surface-variant
                           flex items-center justify-center px-6 h-20 flex-1 text-k-body"
              >
                {T('Thoát')}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => stopRecording(false)}
                className="btn-3d-primary bg-error text-white rounded-3xl flex items-center
                           justify-center gap-3 px-6 h-20 flex-[2]"
              >
                <span className="material-symbols-outlined text-4xl icon-fill">stop_circle</span>
                <span className="text-k-headline">{T('Quay xong')}</span>
              </button>
              <button
                onClick={() => stopRecording(true)}
                className="rounded-3xl border-4 border-outline-variant text-on-surface-variant
                           flex items-center justify-center px-6 h-20 flex-1 text-k-body"
              >
                {T('Huỷ')}
              </button>
            </div>
          )}
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
              <span
                className={`material-symbols-outlined text-4xl icon-fill
                            ${phase === 'sending' ? 'animate-spin' : ''}`}
              >
                {phase === 'sending' ? 'progress_activity' : 'send'}
              </span>
              <span className="text-k-headline whitespace-nowrap">
                {phase !== 'sending'
                  ? T('Gửi bài')
                  : phanTram === null
                    ? T('Đang gửi…')
                    : `${T('Đang gửi…')} ${phanTram}%`}
              </span>
            </button>
            <button
              onClick={() => {
                setPreviewUrl(''); setClip(null); setPhase('idle');
              }}
              disabled={phase === 'sending'}
              className="rounded-3xl border-4 border-outline-variant text-on-surface-variant
                         flex items-center justify-center px-6 h-20 flex-1 text-k-body disabled:opacity-60"
            >
              {T('Quay lại')}
            </button>
          </div>

          {phase === 'sending' && (
            <p className="text-k-body-sm text-on-surface-variant text-center">
              {T('Con đợi một chút, đừng tắt máy nhé.')}
            </p>
          )}
        </div>
      )}

      {/* ---- Chua quay: video da nop (neu co) + nut quay ---- */}
      {phase === 'idle' && (
        <div className="flex flex-col gap-4">
          {existingUrl && (
            <div className="flex flex-col gap-2">
              <p className="text-k-body-sm text-on-surface-variant">{T('Video con đã gửi:')}</p>
              <video
                src={existingUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full max-h-[40vh] rounded-3xl soft-shadow bg-black"
              />
            </div>
          )}

          <button
            onClick={moCamera}
            disabled={starting}
            className="btn-3d-primary bg-tertiary text-on-tertiary rounded-3xl flex items-center
                       justify-center gap-4 px-6 h-20 w-full disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-4xl icon-fill">videocam</span>
            <span className="text-k-headline">
              {starting ? T('Đang mở máy quay…') : existingUrl ? T('Quay video khác') : T('Mở máy quay')}
            </span>
          </button>
        </div>
      )}

      {error && <p className="text-k-body-sm text-error">{error}</p>}
    </div>
  );
}
