'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Quet ma QR in tren to bai tap giay — mo bang may anh cua laptop hoac iPad.
 *
 * Giai ma NGAY TREN MAY bang jsQR: khung hinh chi di <video> -> <canvas> ->
 * jsQR trong cung mot tab, noi dung ma KHONG bao gio roi khoi may. Chon jsQR vi
 * no thuan JavaScript, khong phu thuoc goi khac, khong keo theo tep worker/wasm
 * phai tu cau hinh duong dan — thu vien nap la chay. Khong dung BarcodeDetector
 * cua trinh duyet: Safari tren iPadOS chua co, ma iPad chinh la may con hay cam.
 *
 * Quet xong thi HIEN ra cho con thay no la gi:
 *   - doan nghe / video  -> phat NGAY trong ung dung, con khong phai roi bai
 *     dang lam (dong ho lam bai o duoi van dang chay).
 *   - lien ket thuong    -> HOI con roi moi mo tab moi.
 *   - chu                -> hien nguyen van.
 *
 * May anh phai TAT han khi dong khung quet hoac roi trang: de luong chay ngam
 * tren iPad la ton pin va den may anh sang mai.
 */

type Phase = 'opening' | 'scanning' | 'result' | 'error';

/** Kieu cua ham jsQR — lay tu chinh goi de khong phai ta lai chu ky. */
type JsQR = typeof import('jsqr').default;

type KetQua =
  | { loai: 'audio' | 'video' | 'link'; url: string }
  | { loai: 'text'; text: string };

const DUOI_AUDIO = ['mp3', 'm4a', 'wav', 'ogg', 'oga', 'aac', 'opus', 'flac'];
const DUOI_VIDEO = ['mp4', 'webm', 'mov', 'm4v', 'ogv'];

/** Canh dai nhat cua khung dem ra khi giai ma: du net de doc ma nho, du nhe de iPad kip. */
const KHUNG_PX = 800;
/** Giai ma 8 lan/giay la thua cho tre cam to giay, con lai de danh cho khung hinh muot. */
const NHIP_MS = 120;

/**
 * Doan noi dung ma QR la thu gi. Ma tren sach bai tap thuong tro toi mot doan
 * nghe (mp3) hoac mot trang cua nha xuat ban; con lai la chu.
 */
export function docKetQua(raw: string): KetQua {
  const text = raw.trim();
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { loai: 'text', text };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { loai: 'text', text };
  const duoi = u.pathname.split('.').pop()?.toLowerCase() ?? '';
  if (DUOI_AUDIO.includes(duoi)) return { loai: 'audio', url: text };
  if (DUOI_VIDEO.includes(duoi)) return { loai: 'video', url: text };
  return { loai: 'link', url: text };
}

export default function QuetQR() {
  const [mo, setMo] = useState(false);
  const [phase, setPhase] = useState<Phase>('opening');
  const [ketQua, setKetQua] = useState<KetQua | null>(null);
  const [error, setError] = useState('');
  // null = chua biet (truoc khi mount); tinh sau mount de SSR/khach khop nhau
  const [coMayAnh, setCoMayAnh] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lanCuoiRef = useRef(0);
  const jsQRRef = useRef<JsQR | null>(null);
  /** Con bam hai lan / dong khung khi getUserMedia con dang cho -> bo luong ve sau. */
  const dangMoRef = useRef(false);

  useEffect(() => {
    setCoMayAnh(Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  /** Tat may anh: dung vong quet, tat het track, go luong khoi the <video>. */
  function tatMayAnh() {
    dangMoRef.current = false;
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  // Roi trang giua luc dang quet thi van phai tat may anh (khong cho useEffect
  // nao khac chay truoc): chi dung ref nen ban dong nay luon dung.
  useEffect(() => () => {
    dangMoRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /* Gan luong vao khung xem SAU khi React da ve the <video> — gan ngay trong
     moKhung() thi thua vi luc do the con chua ton tai (giong QuayVideo). */
  useEffect(() => {
    if (phase === 'scanning' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase]);

  async function moKhung() {
    if (dangMoRef.current) return;
    dangMoRef.current = true;
    setMo(true);
    setPhase('opening');
    setError('');
    setKetQua(null);

    // Nap jsQR ngay luc con bam, khong goi vao goi cua trang: man chi tiet bai
    // mo rat nhieu lan ma phan lon bai khong co ma QR nao de quet.
    try {
      if (!jsQRRef.current) jsQRRef.current = (await import('jsqr')).default;
    } catch {
      dangMoRef.current = false;
      setError('Chưa nạp được bộ đọc mã QR. Con thử lại nhé.');
      setPhase('error');
      return;
    }

    let stream: MediaStream;
    try {
      // "environment" la may anh SAU — dung de soi to giay tren iPad. Dat kieu
      // "ideal" chu khong "exact": laptop chi co may anh truoc thi trinh duyet
      // tu lay cai dang co thay vi bao loi.
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch {
      dangMoRef.current = false;
      setError('Chưa mở được máy ảnh. Con nhờ bố mẹ cho phép dùng máy ảnh, hoặc chụp ảnh mã nhé.');
      setPhase('error');
      return;
    }

    // Con da dong khung (hoac roi trang) trong luc bang xin quyen con mo -> bo
    // luong vua nhan, khong thi may anh sang mai ma khong ai tat duoc nua.
    if (!dangMoRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = stream;
    lanCuoiRef.current = 0;
    setPhase('scanning');                       // useEffect [phase] gan srcObject sau khi ve
    rafRef.current = requestAnimationFrame(vongQuet);
  }

  function vongQuet(now: number) {
    rafRef.current = requestAnimationFrame(vongQuet);
    if (now - lanCuoiRef.current < NHIP_MS) return;
    lanCuoiRef.current = now;

    const video = videoRef.current;
    const jsQR = jsQRRef.current;
    if (!video || !jsQR || video.readyState < 2 || !video.videoWidth) return;

    const canvas = (canvasRef.current ??= document.createElement('canvas'));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const ti = Math.min(1, KHUNG_PX / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * ti);
    canvas.height = Math.round(video.videoHeight * ti);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const anh = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Ma tren giay in la den tren nen trang -> khong can thu dao mau, do nhanh gap doi
    const ma = jsQR(anh.data, anh.width, anh.height, { inversionAttempts: 'dontInvert' });
    if (!ma?.data) return;

    tatMayAnh();                                // doc duoc roi thi tat ngay, dung giu may anh
    setKetQua(docKetQua(ma.data));
    setPhase('result');
  }

  /** Duong lui khi khong mo duoc may anh trong trang: chup mot kieu roi doc tren anh. */
  async function docTuAnh(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError('');
    try {
      const jsQR = (jsQRRef.current ??= (await import('jsqr')).default);
      const bitmap = await createImageBitmap(file);
      const canvas = (canvasRef.current ??= document.createElement('canvas'));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error();
      // Anh chup 12MP ma doc nguyen co thi rat cham; ha xuong bang khung quet.
      const ti = Math.min(1, (KHUNG_PX * 2) / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * ti);
      canvas.height = Math.round(bitmap.height * ti);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const anh = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const ma = jsQR(anh.data, anh.width, anh.height);
      if (!ma?.data) {
        setError('Chưa đọc được mã trong ảnh. Con chụp gần và rõ hơn nhé.');
        return;
      }
      setKetQua(docKetQua(ma.data));
      setPhase('result');
    } catch {
      setError('Chưa đọc được ảnh này. Con thử chụp lại nhé.');
    }
  }

  function dongKhung() {
    tatMayAnh();
    setMo(false);
    setKetQua(null);
    setError('');
    setPhase('opening');
  }

  /** Phat khong duoc (nha xuat ban chan, hoac dinh dang la mot trang chu khong phai tep) -> hoi mo tab moi. */
  function khongPhatDuoc(url: string) {
    setKetQua({ loai: 'link', url });
    setError('Bài nghe này không phát được ở đây. Con mở trang của cô nhé.');
  }

  if (coMayAnh === null) return null;            // chua mount xong, tranh lech SSR

  return (
    <>
      <button
        onClick={moKhung}
        className="rounded-3xl border-4 border-tertiary text-tertiary flex items-center
                   justify-center gap-4 px-6 h-20 min-h-k-tap w-full"
      >
        <span className="material-symbols-outlined text-4xl icon-fill">qr_code_scanner</span>
        <span className="text-k-headline">Quét mã QR</span>
      </button>

      {mo && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-k-edge gap-4">
          <div className="shrink-0 flex items-center justify-between gap-4">
            <p className="text-k-headline text-white">
              {phase === 'result' ? 'Mã QR này là:' : 'Đưa mã QR vào khung'}
            </p>
            <button
              onClick={dongKhung}
              className="rounded-full bg-white/15 text-white flex items-center justify-center
                         gap-2 px-6 h-20 min-h-k-tap"
            >
              <span className="material-symbols-outlined text-4xl">close</span>
              <span className="text-k-headline">Đóng</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-6">
            {phase === 'opening' && (
              <p className="text-k-headline text-white">Đang mở máy ảnh…</p>
            )}

            {phase === 'scanning' && (
              <div className="relative w-full max-w-3xl rounded-3xl overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  className="w-full max-h-[60vh] object-contain"
                />
                {/* Khung ngam: lam toi phan ngoai o vuong (bong do trai rong) de tre
                    biet ngay phai chia ma vao giua, ke ca khi to giay trang toat. */}
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="h-2/3 aspect-square rounded-3xl border-4 border-white
                                   shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                </span>
              </div>
            )}

            {phase === 'error' && (
              <div className="flex flex-col items-center gap-6 w-full max-w-xl">
                <span className="material-symbols-outlined text-[96px] text-white/70">
                  no_photography
                </span>
                <label
                  className="btn-3d-primary bg-tertiary text-on-tertiary rounded-3xl flex items-center
                             justify-center gap-4 px-6 h-20 min-h-k-tap w-full cursor-pointer"
                >
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => { docTuAnh(e.target.files); e.target.value = ''; }}
                  />
                  <span className="material-symbols-outlined text-4xl icon-fill">photo_camera</span>
                  <span className="text-k-headline">Chụp ảnh mã QR</span>
                </label>
              </div>
            )}

            {phase === 'result' && ketQua && (
              <div className="flex flex-col items-stretch gap-6 w-full max-w-2xl">
                {ketQua.loai === 'audio' && (
                  <div className="bg-white rounded-3xl p-6 flex items-center gap-4">
                    <span className="material-symbols-outlined text-5xl text-tertiary icon-fill shrink-0">
                      music_note
                    </span>
                    <audio
                      src={ketQua.url}
                      controls
                      autoPlay
                      className="w-full"
                      onError={() => khongPhatDuoc(ketQua.url)}
                    />
                  </div>
                )}

                {ketQua.loai === 'video' && (
                  <video
                    src={ketQua.url}
                    controls
                    autoPlay
                    playsInline
                    className="w-full max-h-[55vh] rounded-3xl bg-black"
                    onError={() => khongPhatDuoc(ketQua.url)}
                  />
                )}

                {ketQua.loai === 'text' && (
                  <p className="bg-white rounded-3xl p-6 text-k-headline text-on-background break-words">
                    {ketQua.text}
                  </p>
                )}

                {ketQua.loai === 'link' && (
                  <div className="flex flex-col gap-4">
                    <div className="bg-white rounded-3xl p-6 flex flex-col gap-2">
                      <p className="text-k-headline text-on-background">Một trang trên mạng</p>
                      <p className="text-k-body-sm text-on-surface-variant break-all">
                        {ketQua.url}
                      </p>
                    </div>
                    {/* Mo trang la roi bai dang lam -> hoi con truoc, va mo sang tab
                        moi de bai tap va dong ho van con nguyen o tab nay. */}
                    <button
                      onClick={() => window.open(ketQua.url, '_blank', 'noopener,noreferrer')}
                      className="btn-3d-primary bg-primary text-on-primary rounded-3xl flex items-center
                                 justify-center gap-4 px-6 h-20 min-h-k-tap w-full"
                    >
                      <span className="material-symbols-outlined text-4xl icon-fill">open_in_new</span>
                      <span className="text-k-headline">Mở trang này</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={moKhung}
                  className="rounded-3xl border-4 border-white/60 text-white flex items-center
                             justify-center gap-4 px-6 h-20 min-h-k-tap w-full"
                >
                  <span className="material-symbols-outlined text-4xl">qr_code_scanner</span>
                  <span className="text-k-headline">Quét mã khác</span>
                </button>
              </div>
            )}

            {error && <p className="text-k-body-sm text-white text-center max-w-xl">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
