/**
 * Phien ghi video trong trang (MediaRecorder) + bo canh luong dung (issue #51).
 *
 * VI SAO TACH RA KHOI QuayVideo.tsx: vong doi ghi (tao MediaRecorder, dong ho,
 * dung/huy, ghep Blob, va lai thoi luong) khong can React va PHAI kiem thu duoc
 * bang node --test voi MediaRecorder gia + dong ho gia. Component chi con ve
 * man hinh va anh xa `LyDoKetThuc` -> phase + cau bao cho con.
 *
 * LUONG DUNG (#51, bao cao data/btvn-video-macbook-dieu-tra trong home
 * firstmate, do tren 10 video that): tren MacBook Safari, giua buoi quay ca
 * camera lan mic NGUNG sinh mau cung luc (lech < 0,02 s) trong khi track van
 * `live`, MediaRecorder van `recording` va dong ho van dem tiep. Khi dung,
 * muxer Safari ghi MOT khung video cuoi dai bang khoang trong toi moc dung ->
 * noi dung that chi toi moc dung (phan sau la mot khung dong cung), con
 * thoi luong Safari doc ra bang ca buoi quay (2,2-2,9x). KHONG ban va metadata
 * nao cuu duoc: media sau moc dung CHUA TUNG duoc ghi. Cach sua duy nhat la
 * phat hien NGAY LUC QUAY, tu dung, khong luu, bao con quay lai.
 *
 * Cach phat hien: theo doi luong co con SINH KHUNG THAT khong, thay vi chi dem
 * giay mu. Hai nguon tin, cai nao toi truoc thi dung:
 *
 *   1. Nhip khung xem truoc — `requestVideoFrameCallback` tren the <video> dang
 *      chieu chinh luong dua vao MediaRecorder: moi khung moi toi la mot nhip.
 *      Day la bang chung truc tiep "camera con sinh khung", khong phu thuoc
 *      Safari co ban su kien gi khi dung hay khong (bao cao khong do duoc
 *      dieu do). Qua NGUONG_LUONG_DUNG_MS khong co nhip -> dung.
 *   2. Su kien `mute` / `ended` cua MediaStreamTrack: `ended` la nguon da mat,
 *      dung ngay; `mute` keo dai qua nguong cung la dung (mute ngan — vd iPadOS
 *      tam ngat khi ra nen roi vao lai — thi bo qua).
 *
 * THU BAC HAI NGUON — khong ngang nhau: `mute`/`ended` den tu CHINH track cua
 * camera nen LUON co hieu luc. Nhip rVFC chi la tin hieu PHU: no do the <video>
 * xem truoc CHIEU duoc khung len man, khong do truc tiep camera sinh khung, nen
 * chi dung lam bang chung khi khung do vua hien vua dang chay.
 *
 * BA HANG RAO chong bao nham, vi mot khoang lang binh thuong KHONG duoc coi la
 * dung:
 *   - Tab an (document.hidden): trinh duyet KHONG chay "update the rendering"
 *     cho tai lieu an, nen rVFC im lang du camera van chay. Trong luc an ta
 *     khong phan xu (ke ca mute: iPadOS tam ngat nguon khi ra nen); hien lai thi
 *     tinh nguong tu dau.
 *   - Luong chinh bi nghen (tick den muon qua NGUONG_TICK_MUON_MS): rVFC va
 *     setInterval deu xep hang tren luong chinh, ca hai cung muon nen "khong co
 *     nhip" khong noi gi ve camera. Tick do chi dat lai moc, khong phan xu.
 *   - Khung xem truoc khong chieu (`khungDangChieu()` false): rVFC ban theo buoc
 *     "update the rendering" cho phan tu duoc COMPOSITE, nen the <video> cuon ra
 *     khoi vung nhin (con cuon len doc lai de bai giua buoi quay) hoac play() bi
 *     tu choi la rVFC im lang du camera van sinh khung — bat o day thi vut mat
 *     mot ban quay tot. Chi tam ngung BO DEM KHUNG; theo thu bac tren, mute va
 *     ended van phan xu binh thuong. Noi vao DOM bang theoDoiKhungChieu().
 *
 * NGUONG 4 giay — chon than trong: camera 15-30 fps cach khung 33-67 ms, thieu
 * sang xuong ~7 fps cung chi ~140 ms, tuc 4 s la gap ~30 lan khoang cach xau
 * nhat binh thuong; con mot cu dung that thi 4 s chi la thoi gian con phai doi
 * de duoc bao — noi dung sau moc dung von khong duoc ghi, nguong khong lam mat
 * them gi. Bao cao thay dung o giay 14-24 va buoi <= 5 s khong dinh, nhung mau
 * nho, khong co moc co dinh de dua vao.
 *
 * CHUA DO TREN MACBOOK THAT CO CAMERA (may dieu tra khong co camera, Safari
 * automation tat): moi thu o day kiem bang bo gia trong lib/phienQuay.test.ts
 * va bang luong canvas gia tren Chrome. Captain kiem cuoi tren may minh.
 */

import type { Key } from './i18n/en';
import { fixVideoDuration } from './videoDuration';

/** Khong co khung/mau moi lau hon muc nay (ms) trong luc tab dang hien = luong dung. */
export const NGUONG_LUONG_DUNG_MS = 4000;
/** Chu ky dong ho quay (ms) — cung la chu ky kiem luong. */
export const CHU_KY_TICK_MS = 1000;
/** Tick den muon hon muc nay (ms) = luong chinh vua bi nghen, khong phan xu o tick do. */
export const NGUONG_TICK_MUON_MS = 2500;

/** mp4 truoc (Safari chi ghi duoc mp4), webm sau (Chrome/Firefox). */
export const MIME_UU_TIEN = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

/**
 * Vi sao phien ket thuc:
 *   'xong'          con bam "Quay xong" hoac het gio — co clip (da va thoi luong)
 *   'trong'         dung binh thuong nhung khong nhan duoc byte nao
 *   'huy'           con bam "Huỷ" — bo, khong bao gi
 *   'gian-doan'     luong dung / track ended / recorder tu dung hoac loi giua chung
 *                   -> KHONG luu, bao con quay lai (#51)
 *   'khong-ghi-duoc' MediaRecorder khong tao/khoi dong duoc voi luong nay
 */
export type LyDoKetThuc = 'xong' | 'trong' | 'huy' | 'gian-doan' | 'khong-ghi-duoc';

export type KetQuaPhien =
  | { lyDo: 'xong'; clip: Blob; /** So giay dong ho dem duoc. */ giay: number }
  | { lyDo: Exclude<LyDoKetThuc, 'xong'>; clip: null; giay: number };

/** Cau con doc khi phien ket thuc ma KHONG co clip. Bang khoa dich — ve bang T(). */
export const CAU_BAO_KET_THUC: Record<Exclude<LyDoKetThuc, 'xong' | 'huy'>, Key> = {
  'trong': 'Chưa quay được gì, con thử lại nhé.',
  'gian-doan': 'Máy quay bị gián đoạn giữa chừng nên bản này chưa lưu. Con mở máy quay và quay lại nhé.',
  'khong-ghi-duoc': 'Máy này chưa quay video trong trang được. Con nhờ bố mẹ mở bằng Safari hoặc Chrome mới hơn nhé.',
};

/**
 * Cau con doc khi MO camera that bai (getUserMedia nem loi). Tu khi bo duong
 * "quay bang may anh" (quyet dinh cua captain, #51) day la luoi an toan DUY
 * NHAT: moi cau phai noi ro con/bo me PHAI LAM GI, khong hien loi ky thuat.
 * Ten loi theo chuan MediaDevices.getUserMedia; ten cu (PermissionDenied…,
 * DevicesNotFound…, TrackStart…) la cua Chrome doi truoc, giu cho chac.
 */
export const CAU_BAO_MO_CAMERA: Record<'tu-choi' | 'khong-co' | 'dang-ban' | 'khac', Key> = {
  'tu-choi': 'Máy chưa cho phép dùng máy quay. Con nhờ bố mẹ bấm "Cho phép" khi máy hỏi, rồi thử lại nhé.',
  'khong-co': 'Không tìm thấy máy quay trên máy này. Con dùng iPad hoặc máy có máy quay nhé.',
  'dang-ban': 'Máy quay đang bận vì ứng dụng khác đang dùng. Con tắt ứng dụng đó rồi thử lại nhé.',
  'khac': 'Chưa mở được máy quay. Con thử lại, hoặc nhờ bố mẹ giúp nhé.',
};

export function phanLoaiLoiMoCamera(loi: unknown): keyof typeof CAU_BAO_MO_CAMERA {
  const ten = typeof loi === 'object' && loi !== null && 'name' in loi ? String((loi as { name: unknown }).name) : '';
  switch (ten) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'tu-choi';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'khong-co';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'dang-ban';
    default:
      return 'khac';
  }
}

/** Phan cua MediaRecorder ma phien dung — de test tiem ban gia. */
export interface BoGhi {
  readonly state: 'inactive' | 'recording' | 'paused';
  readonly mimeType: string;
  ondataavailable: ((ev: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((ev: unknown) => void) | null;
  start(): void;
  stop(): void;
}
export interface LopBoGhi {
  new (stream: MediaStream, options: MediaRecorderOptions): BoGhi;
  isTypeSupported(mime: string): boolean;
}

export interface TuyChonPhien {
  stream: MediaStream;
  /** Moi giay mot lan, so giay da ghi. */
  onGiay: (giay: number) => void;
  /** Dung mot lan khi phien ket thuc (khong goi sau boRoi()). */
  onKetThuc: (kq: KetQuaPhien) => void;
  /**
   * Co nguon nhip khung (rVFC) khong. false = trinh duyet khong ho tro, chi con
   * theo doi mute/ended. PHAI dat false khi khong noi nhipKhung(), khong thi
   * "khong co nhip" bi hieu la dung.
   */
  theoDoiKhung: boolean;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  /** Het gio thi tu dung nhu bam "Quay xong". */
  maxGiay: number;
  /** Tab co dang hien khong — mac dinh doc document.visibilityState. */
  dangHien?: () => boolean;
  /**
   * Khung xem truoc co dang chieu khung len man khong (trong vung nhin + dang
   * chay). false = nhip rVFC mat gia tri lam bang chung, tam ngung bo dem khung.
   * Mac dinh true — dung theoDoiKhungChieu() de noi vao the <video> that.
   */
  khungDangChieu?: () => boolean;
  // ---- Cho test tiem vao ----
  LopBoGhi?: LopBoGhi;
  bayGio?: () => number;
  nguongDungMs?: number;
  vaThoiLuong?: (blob: Blob, giay: number) => Promise<Blob>;
}

export interface PhienQuay {
  /** Tao + start MediaRecorder. false = khong ghi duoc (onKetThuc da nhan 'khong-ghi-duoc'). */
  batDau(): boolean;
  /** Con bam "Quay xong" (huy=false) hoac "Huỷ" (huy=true). Goi lan hai bi bo qua. */
  dung(huy: boolean): void;
  /** Mot khung moi vua toi khung xem truoc. */
  nhipKhung(): void;
  /** Roi trang: dung, tat luong, KHONG goi onKetThuc. */
  boRoi(): void;
}

const docDangHien = () =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

export function taoPhienQuay(o: TuyChonPhien): PhienQuay {
  const Lop: LopBoGhi = o.LopBoGhi ?? (MediaRecorder as unknown as LopBoGhi);
  const bayGio = o.bayGio ?? (() => performance.now());
  const dangHien = o.dangHien ?? docDangHien;
  const khungDangChieu = o.khungDangChieu ?? (() => true);
  const nguong = o.nguongDungMs ?? NGUONG_LUONG_DUNG_MS;
  const vaThoiLuong = o.vaThoiLuong ?? fixVideoDuration;

  let recorder: BoGhi | null = null;
  const chunks: Blob[] = [];
  let giay = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  // Ket thuc MOT lan: stop() dat state = 'inactive' NGAY nhung chi xep hang
  // onstop, hai nut "Quay xong"/"Huỷ" van con tren man hinh trong cua so do.
  // Bam lan hai ma khong chan thi no dat lai ly do (huy hoi sinh ban vua huy,
  // hoac bao "chua quay duoc gi" tren mot ban tot).
  let daKetThuc = false;
  let daBoRoi = false;
  let mocKhung = 0;      // lan cuoi co khung moi (hoac moc dat lai)
  let mocTick = 0;       // lan cuoi tick chay — do luong chinh co nghen khong
  // Moc mute cua TUNG track (khong co khoa = track do khong mute). Mot moc dung
  // chung cho ca luong thi track nay unmute la xoa luon moc cua track kia dang
  // con mute — mic chet tu dau buoi ma hinh chi ngat mot nhip la du de bo hieu
  // luc hang rao, va con nop mot ban khong co tieng.
  const mocMute = new Map<MediaStreamTrack, number>();
  const goSuKien: (() => void)[] = [];

  function tatLuong() {
    o.stream.getTracks().forEach((t) => t.stop());
  }
  function donDep() {
    if (timer) { clearInterval(timer); timer = null; }
    goSuKien.splice(0).forEach((g) => g());
  }
  function baoKetThuc(kq: KetQuaPhien) {
    if (!daBoRoi) o.onKetThuc(kq);
  }

  /** Ket thuc ma KHONG giu gi: huy / gian doan / khong ghi duoc. */
  function boPhien(lyDo: Exclude<LyDoKetThuc, 'xong' | 'trong'>) {
    if (daKetThuc) return;
    daKetThuc = true;
    donDep();
    const r = recorder;
    recorder = null;
    chunks.length = 0;
    if (r) {
      // onstop cua no toi sau (hoac khong toi neu luong da chet) — khong con
      // viec gi cho no lam, va khong duoc de no dua phien da bo ve 'xong'.
      r.onstop = () => { chunks.length = 0; };
      r.ondataavailable = null;
      if (r.state !== 'inactive') { try { r.stop(); } catch { /* luong chet, stop() co the nem */ } }
    }
    tatLuong();
    baoKetThuc({ lyDo, clip: null, giay });
  }

  /** Ket thuc GIU ban ghi: cho recorder day het du lieu roi ghep + va thoi luong. */
  function chotPhien() {
    if (daKetThuc) return;
    daKetThuc = true;
    donDep();
    const r = recorder;
    if (!r || r.state === 'inactive') {
      // Khong con may ghi nao se ban onstop nua
      recorder = null;
      tatLuong();
      baoKetThuc({ lyDo: 'trong', clip: null, giay });
      return;
    }
    r.onstop = () => {
      recorder = null;
      tatLuong();
      const out = new Blob(chunks.splice(0), { type: r.mimeType || 'video/mp4' });
      if (out.size === 0) { baoKetThuc({ lyDo: 'trong', clip: null, giay }); return; }
      // Dong ho da dem duoc dung so giay THAT — dung no de va lai metadata
      // duration cua container (issue #32; voi mp4 phan manh fixVideoDuration ghi
      // mdhd = 0 va chen mvex>mehd — Blob tra ve co the dai hon `out` 16 byte,
      // xem chu thich dau lib/videoDuration.ts). Chi va khi phien con song, vi
      // luong dung da bi boPhien() chan tu truoc — toi day la ban ghi lanh.
      // Va that bai (mp4 la lam DataView doc qua bien, arrayBuffer loi…) thi ban
      // ghi VAN lanh — chi metadata duration chua sua. Giao ban GOC ra: de loi
      // roi ra ngoai la phien ket thuc ma khong ai goi onKetThuc, man hinh ket o
      // 'recording' voi dong ho dong bang va hai nut chet (daKetThuc da bat), con
      // mat ca ban quay.
      vaThoiLuong(out, giay).then(
        (fixed) => baoKetThuc({ lyDo: 'xong', clip: fixed, giay }),
        () => baoKetThuc({ lyDo: 'xong', clip: out, giay }),
      );
    };
    r.stop();
  }

  /** Moi giay: dem gio, het gio thi chot, roi kiem luong. */
  function tick() {
    if (daKetThuc) return;
    const now = bayGio();
    giay += 1;
    o.onGiay(giay);
    if (giay >= o.maxGiay) { chotPhien(); return; }

    const tickMuon = now - mocTick > NGUONG_TICK_MUON_MS;
    mocTick = now;
    if (!dangHien() || tickMuon) {
      // Tab an hoac luong chinh vua nghen: khong co nhip khong noi gi ve camera.
      // Dat lai moc — nguong tinh lai tu luc quan sat duoc.
      mocKhung = now;
      for (const t of mocMute.keys()) mocMute.set(t, now);
      return;
    }
    // Khung xem truoc khong chieu: bo dem khung tam ngung (hang rao thu ba),
    // nhung mute/ended la tin hieu tu camera nen van phan xu ngay duoi day.
    if (!khungDangChieu()) mocKhung = now;
    else if (o.theoDoiKhung && now - mocKhung >= nguong) { boPhien('gian-doan'); return; }
    for (const moc of mocMute.values()) {
      if (now - moc >= nguong) { boPhien('gian-doan'); return; }
    }
  }

  function nghe(track: MediaStreamTrack) {
    const onMute = () => { if (!mocMute.has(track)) mocMute.set(track, bayGio()); };
    const onUnmute = () => { mocMute.delete(track); };
    const onEnded = () => boPhien('gian-doan');
    track.addEventListener('mute', onMute);
    track.addEventListener('unmute', onUnmute);
    track.addEventListener('ended', onEnded);
    goSuKien.push(() => {
      track.removeEventListener('mute', onMute);
      track.removeEventListener('unmute', onUnmute);
      track.removeEventListener('ended', onEnded);
    });
    if (track.muted) mocMute.set(track, bayGio());
  }

  return {
    batDau() {
      const mime = MIME_UU_TIEN.find((m) => Lop.isTypeSupported(m)) ?? '';
      let r: BoGhi;
      try {
        r = new Lop(o.stream, {
          ...(mime ? { mimeType: mime } : {}),
          videoBitsPerSecond: o.videoBitsPerSecond,
          audioBitsPerSecond: o.audioBitsPerSecond,
        });
      } catch {
        boPhien('khong-ghi-duoc');
        return false;
      }
      recorder = r;
      r.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      // Recorder tu dung / bao loi khi TA chua dung = nguon ghi vua chet giua
      // chung (track ended, ma hoa hong…): khong tin ban ghi nay.
      r.onstop = () => boPhien('gian-doan');
      r.onerror = () => boPhien('gian-doan');
      // start() co the nem du constructor da qua: isTypeSupported chi noi may BIET
      // mimeType do, khong hua ma hoa duoc luong nay o bitrate nay (Safari/iPadOS).
      try {
        r.start();
      } catch {
        recorder = null;
        boPhien('khong-ghi-duoc');
        return false;
      }
      const now = bayGio();
      mocKhung = now;
      mocTick = now;
      o.stream.getTracks().forEach(nghe);
      timer = setInterval(tick, CHU_KY_TICK_MS);
      return true;
    },
    dung(huy) {
      if (huy) boPhien('huy');
      else chotPhien();
    },
    nhipKhung() {
      if (!daKetThuc) mocKhung = bayGio();
    },
    boRoi() {
      daBoRoi = true;
      boPhien('huy');
    },
  };
}

/**
 * Noi nhip khung cua the <video> xem truoc vao phien qua requestVideoFrameCallback.
 * Tra ve ham go. Trinh duyet khong ho tro thi khong noi gi — goi hoTroNhipKhung()
 * truoc de dat `theoDoiKhung` cho dung.
 */
export function hoTroNhipKhung(video: HTMLVideoElement | null): boolean {
  return !!video && typeof video.requestVideoFrameCallback === 'function';
}

export interface CanhKhungChieu {
  /** Khung xem truoc dang chieu khung len man (trong vung nhin + dang chay). */
  dangChieu(): boolean;
  go(): void;
}

/**
 * Do xem the <video> xem truoc co dang CHIEU khung khong — nguon cho
 * `khungDangChieu` (hang rao thu ba, xem chu thich dau tep).
 *
 * Hai dieu kien, thieu mot la nhip rVFC im lang du camera van chay:
 *   - trong vung nhin: IntersectionObserver (nguong mac dinh — che mot phan van
 *     duoc composite nen van co nhip). May khong co IntersectionObserver thi coi
 *     nhu dang hien, de khong tat luon hang rao chinh.
 *   - dang chay: `paused`/`ended` cua the <video> — play() bi tu choi (chinh
 *     sach autoplay) la khung dung mai, khong phai camera dung.
 */
export function theoDoiKhungChieu(video: HTMLVideoElement): CanhKhungChieu {
  // Chua co bao cao nao thi coi nhu dang hien: IntersectionObserver ban ban ghi
  // dau TIEN sau khi observe(), ma buoi quay bat dau ngay truoc do.
  let trongVungNhin = true;
  const obs =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((ds) => {
          const cuoi = ds.at(-1);
          if (cuoi) trongVungNhin = cuoi.isIntersecting;
        })
      : null;
  obs?.observe(video);
  return {
    dangChieu: () => trongVungNhin && !video.paused && !video.ended,
    go: () => obs?.disconnect(),
  };
}

export function noiNhipKhung(video: HTMLVideoElement, phien: Pick<PhienQuay, 'nhipKhung'>): () => void {
  if (!hoTroNhipKhung(video)) return () => {};
  let song = true;
  let id = 0;
  const lap = () => {
    if (!song) return;
    phien.nhipKhung();
    id = video.requestVideoFrameCallback(lap);
  };
  id = video.requestVideoFrameCallback(lap);
  return () => {
    song = false;
    video.cancelVideoFrameCallback?.(id);
  };
}
