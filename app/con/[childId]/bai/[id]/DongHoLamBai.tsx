'use client';

import { useEffect, useRef, useState } from 'react';
import { pickVoice } from '@/lib/speech';

/**
 * Dong ho lam bai — con bam "Bat dau lam" la dem nguoc tu thoi luong cua bai.
 *
 * Nguyen tac: nhe nhang, khich le, khong phat. Het gio chi co chuong diu + loi
 * dong vien, dong ho chuyen sang dem qua gio mau xam va con van tick xong binh
 * thuong.
 *
 * Chi luu MOC BAT DAU vao localStorage theo id bai — moi lan tick tinh lai tu
 * moc do, nen lo tay reload hay tab bi an roi quay lai thi gio khong troi.
 */

const KEY = (assignmentId: string) => `btvn:dongho:${assignmentId}`;

/** Moc bat dau (epoch ms) da luu, hoac null neu chua bam Bat dau. */
export function docMocBatDau(assignmentId: string): number | null {
  // localStorage co the nem loi (Safari che do rieng tu cu) -> coi nhu chua bam
  try {
    const n = Number(localStorage.getItem(KEY(assignmentId)));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function xoaDongHo(assignmentId: string): void {
  try {
    localStorage.removeItem(KEY(assignmentId));
  } catch { /* khong xoa duoc thi lan sau van tu het han theo moc cu, khong sao */ }
}

/** Dong ho dang chay va CON GIO khong — quyet dinh co an mung "xong som". */
export function conThoiGian(assignmentId: string, minutes: number): boolean {
  const start = docMocBatDau(assignmentId);
  return start !== null && Date.now() - start < minutes * 60_000;
}

/** Doc mot cau tieng Viet — cung giong nu uu tien nhu nut "Nghe de bai". */
export function noi(text: string): void {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'vi-VN';
  u.rate = 0.9;
  const v = pickVoice(speechSynthesis.getVoices(), 'vi');
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

/**
 * Cac moc nhac giong noi cua mot bai:
 *   - Moi 5 phut troi qua doc con bao nhieu phut ("Còn 10 phút nhé!").
 *     Bo moc nao chi con duoi 2 phut — de danh cho loi nhac phut cuoi.
 *   - Phut cuoi: "Còn 1 phút, cố lên con!".
 * atSec la GIAY DA TROI QUA de den moc do.
 */
export function mocNhac(totalMinutes: number): { atSec: number; text: string }[] {
  const mocs: { atSec: number; text: string }[] = [];
  for (let daQua = 5; daQua < totalMinutes; daQua += 5) {
    const conLai = totalMinutes - daQua;
    if (conLai >= 2) mocs.push({ atSec: daQua * 60, text: `Còn ${conLai} phút nhé!` });
  }
  if (totalMinutes >= 2) {
    mocs.push({ atSec: (totalMinutes - 1) * 60, text: 'Còn 1 phút, cố lên con!' });
  }
  return mocs;
}

/** Tao AudioContext (Safari cu la webkitAudioContext), khong co thi null. */
function taoAudioContext(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return Ctx ? new Ctx() : null;
  } catch {
    return null;
  }
}

/**
 * Chuong bao het gio — hai not sin diu dan (E5 -> C5) qua WebAudio, khong tai
 * tep tu ngoai. Dung lai AudioContext da mo khoa trong cu cham "Bat dau lam":
 * iPad Safari de context tao ngoai cu chi nguoi dung o trang thai suspended va
 * phat im lang. Khong co context thi thoi, van con loi doc va thong diep.
 */
function chuongDiu(ctx: AudioContext | null): void {
  try {
    if (!ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    for (const [freq, delay] of [[659.25, 0], [523.25, 0.35]]) {
      const o = ctx.createOscillator();
      const gain = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.1);
      o.connect(gain).connect(ctx.destination);
      o.start(now + delay);
      o.stop(now + delay + 1.2);
    }
    setTimeout(() => {
      if (ctx.state !== 'closed') void ctx.close().catch(() => {});
    }, 2000);
  } catch { /* iPad khong phat duoc am thi van co thong diep tren man */ }
}

const fmt = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/* Chu vi vong tien do (r = 88 trong viewBox 200x200) */
const CHU_VI = 2 * Math.PI * 88;

export default function DongHoLamBai({
  assignmentId,
  minutes,
}: {
  assignmentId: string;
  minutes: number;
}) {
  const totalSec = minutes * 60;
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  /* null = chua khoi tao. Lan tick dau danh dau IM LANG moi moc da qua, de
     reload giua chung khong doc lai loat nhac cu. */
  const daNhac = useRef<Set<number> | null>(null);
  const daHetGio = useRef(false);
  /* Mo khoa trong cu cham "Bat dau lam", giu lai cho chuong het gio */
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => () => {
    try {
      const ctx = audioCtx.current;
      if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
    } catch { /* dong khong duoc cung khong sao */ }
  }, []);

  // Doc moc bat dau da luu — con lo tay reload thi dong ho chay tiep ngay
  useEffect(() => {
    setStartAt(docMocBatDau(assignmentId));
    daNhac.current = null;
    daHetGio.current = false;
  }, [assignmentId]);

  useEffect(() => {
    if (startAt === null) return;
    setNow(Date.now());
    // Tab bi an thi interval bi nen lai cung khong sao: moi tick tinh tu moc
    // bat dau chu khong cong don, quay lai la gio dung ngay.
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [startAt]);

  const elapsedSec = startAt !== null && now > 0 ? Math.floor((now - startAt) / 1000) : 0;
  const hetGio = startAt !== null && elapsedSec >= totalSec;

  // Nhac giong noi + chuong het gio — chay theo tick, khong theo render
  useEffect(() => {
    if (startAt === null || now === 0) return;

    const mocs = mocNhac(minutes);
    if (daNhac.current === null) {
      // Lan tick dau sau khi mo man: moc nao da qua thi ghi nhan im lang
      daNhac.current = new Set(mocs.filter((m) => m.atSec <= elapsedSec).map((m) => m.atSec));
      daHetGio.current = elapsedSec >= totalSec;
      return;
    }

    if (!daHetGio.current) {
      // Tab bi an lau co the vuot nhieu moc mot luc -> chi doc moc moi nhat
      const vuaQua = mocs.filter((m) => m.atSec <= elapsedSec && !daNhac.current!.has(m.atSec));
      if (vuaQua.length > 0 && elapsedSec < totalSec) {
        for (const m of vuaQua) daNhac.current.add(m.atSec);
        noi(vuaQua[vuaQua.length - 1].text);
      }
      if (elapsedSec >= totalSec) {
        daHetGio.current = true;
        // Reload giua chung thi chua co cu cham nao -> tao moi lam phuong an cuoi
        if (!audioCtx.current || audioCtx.current.state === 'closed') {
          audioCtx.current = taoAudioContext();
        }
        chuongDiu(audioCtx.current);
        noi('Hết giờ rồi, con làm nốt nhé!');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  function batDau() {
    const t = Date.now();
    try {
      localStorage.setItem(KEY(assignmentId), String(t));
    } catch { /* khong luu duoc thi reload mat gio, van chay duoc phien nay */ }
    daNhac.current = new Set();
    daHetGio.current = false;
    // Cu cham nay la luc iPad cho phep mo khoa WebAudio -> mo san cho chuong het gio
    try {
      if (!audioCtx.current || audioCtx.current.state === 'closed') {
        audioCtx.current = taoAudioContext();
      }
      void audioCtx.current?.resume().catch(() => {});
    } catch { /* khong co am thanh thi van con giong doc va thong diep tren man */ }
    setStartAt(t);
    // Bam nut la mot cu cham -> iPad cho phep doc; cac cau nhac sau do moi chay duoc
    noi(`Con có ${minutes} phút để làm bài. Bắt đầu nhé!`);
  }

  if (startAt === null) {
    return (
      <button
        onClick={batDau}
        className="btn-3d-amber text-on-tertiary-fixed rounded-3xl flex items-center
                   justify-center gap-4 px-6 h-20 w-full"
      >
        <span className="text-4xl">🚀</span>
        <span className="text-k-headline">Bắt đầu làm — {minutes} phút</span>
      </button>
    );
  }

  const remainingSec = Math.max(0, totalSec - elapsedSec);
  const frac = totalSec > 0 ? remainingSec / totalSec : 0;
  // Xanh la -> vang ho phach -> do nhat khi sap het; qua gio thi xam nhe nhang
  const mau = hetGio ? '#9ca3af' : frac > 0.5 ? '#22c55e' : frac > 0.2 ? '#f59e0b' : '#f87171';

  return (
    <div className="flex flex-col items-center gap-2 self-center">
      <div className="relative w-60 h-60">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <circle cx="100" cy="100" r="88" fill="none" stroke="#e8e8ec" strokeWidth="14" />
          <circle
            cx="100" cy="100" r="88" fill="none"
            stroke={mau} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={CHU_VI}
            strokeDashoffset={CHU_VI * (1 - frac)}
            style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 1s linear' }}
          />
        </svg>

        {/* Ten lua bay theo dau vong tien do, ha canh o dinh khi het gio */}
        <div
          className="absolute inset-0"
          style={{ transform: `rotate(${frac * 360}deg)`, transition: 'transform 0.5s linear' }}
        >
          <span
            className="absolute left-1/2 text-4xl"
            style={{ top: '6%', transform: 'translate(-50%, -50%)' }}
          >
            🚀
          </span>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hetGio ? (
            <>
              <span className="text-k-body-sm text-outline">Quá giờ</span>
              <span
                className="text-[52px] font-bold leading-none text-outline"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                +{fmt(elapsedSec - totalSec)}
              </span>
            </>
          ) : (
            <span
              className="text-[56px] font-bold leading-none"
              style={{ color: mau, fontVariantNumeric: 'tabular-nums' }}
            >
              {fmt(remainingSec)}
            </span>
          )}
        </div>
      </div>

      {hetGio && (
        <p className="text-k-body text-on-surface-variant text-center">
          Hết giờ rồi, con làm nốt nhé! 💪
        </p>
      )}
    </div>
  );
}
