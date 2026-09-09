/**
 * Kiem thu phien ghi video + bo canh luong dung (issue #51) — bang MediaRecorder
 * gia, luong gia va dong ho gia, KHONG can trinh duyet.
 *
 * Kich ban chinh mo phong dung cu dung do duoc tren 10 video that (bao cao
 * data/btvn-video-macbook-dieu-tra trong home firstmate): track van `live`,
 * recorder van `recording`, dong ho van dem, chi co KHUNG NGUNG TOI. App phai
 * TU DUNG, KHONG luu, va bao con bang cau doc duoc.
 *
 * Day la mo phong: cu dung that tren MacBook co camera chua do duoc o may phat
 * trien (khong co camera, Safari automation tat). Captain kiem cuoi tren may minh.
 */

import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAU_BAO_KET_THUC,
  CAU_BAO_MO_CAMERA,
  NGUONG_LUONG_DUNG_MS,
  hoTroNhipKhung,
  noiNhipKhung,
  phanLoaiLoiMoCamera,
  taoPhienQuay,
  theoDoiKhungChieu,
  type BoGhi,
  type KetQuaPhien,
  type LopBoGhi,
} from './phienQuay.ts';
import { T_VI, TU_DIEN } from './i18n/chu.ts';

// ---------------------------------------------------------------- bo gia

class TrackGia extends EventTarget {
  readyState: 'live' | 'ended' = 'live';
  muted = false;
  kind: 'video' | 'audio';
  constructor(kind: 'video' | 'audio') { super(); this.kind = kind; }
  stop() { this.readyState = 'ended'; }
  /** Nguon tam ngat (Safari ban 'mute') — track VAN live. */
  mute() { this.muted = true; this.dispatchEvent(new Event('mute')); }
  unmute() { this.muted = false; this.dispatchEvent(new Event('unmute')); }
  /** Nguon mat han. */
  end() { this.readyState = 'ended'; this.dispatchEvent(new Event('ended')); }
}

function taoLuongGia() {
  const tracks = [new TrackGia('video'), new TrackGia('audio')];
  const stream = { getTracks: () => tracks } as unknown as MediaStream;
  return { stream, tracks };
}

/**
 * MediaRecorder gia: start() -> 'recording'; stop() -> 'inactive' ngay, roi
 * ondataavailable + onstop den SAU (microtask) dung nhu trinh duyet that.
 * Trong luc "quay" no van nhan du lieu deu — nhu Safari khi luong dung: recorder
 * KHONG tu biet gi ca, chi co khung khong toi.
 */
class BoGhiGia implements BoGhi {
  static daTao: BoGhiGia[] = [];
  static nemLucTao = false;
  static nemLucStart = false;
  static isTypeSupported(m: string) { return m === 'video/mp4;codecs=avc1'; }
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType = 'video/mp4';
  ondataavailable: ((ev: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  options: MediaRecorderOptions;
  constructor(_s: MediaStream, options: MediaRecorderOptions) {
    if (BoGhiGia.nemLucTao) throw new DOMException('x', 'NotSupportedError');
    this.options = options;
    BoGhiGia.daTao.push(this);
  }
  start() {
    if (BoGhiGia.nemLucStart) throw new DOMException('x', 'NotSupportedError');
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob([new Uint8Array(16)]) });
      this.onstop?.();
    });
  }
}
const Lop = BoGhiGia as unknown as LopBoGhi;

let now = 0;
let hien = true;

beforeEach(() => {
  now = 0;
  hien = true;
  BoGhiGia.daTao = [];
  BoGhiGia.nemLucTao = false;
  BoGhiGia.nemLucStart = false;
  mock.timers.enable({ apis: ['setInterval'] });
});
afterEach(() => mock.timers.reset());

/** Troi qua `ms` mili giay, chay dong ho cua phien theo tung 1000 ms. */
function troi(ms: number) {
  while (ms > 0) {
    const buoc = Math.min(ms, 1000);
    now += buoc;
    mock.timers.tick(buoc);
    ms -= buoc;
  }
}
/** Camera dang chay binh thuong `giay` giay: 10 khung/giay toi khung xem truoc. */
function camChay(phien: { nhipKhung(): void }, giay: number) {
  for (let i = 0; i < giay * 10; i++) { troi(100); phien.nhipKhung(); }
}
const choMicrotask = () => new Promise<void>((r) => setImmediate(r));

function taoPhien(o: Partial<Parameters<typeof taoPhienQuay>[0]> = {}) {
  const { stream, tracks } = taoLuongGia();
  const ketThuc: KetQuaPhien[] = [];
  const daVa: [Blob, number][] = [];
  const giay: number[] = [];
  const phien = taoPhienQuay({
    stream,
    theoDoiKhung: true,
    videoBitsPerSecond: 1, audioBitsPerSecond: 1,
    maxGiay: 600,
    onGiay: (g) => giay.push(g),
    onKetThuc: (kq) => ketThuc.push(kq),
    dangHien: () => hien,
    LopBoGhi: Lop,
    bayGio: () => now,
    vaThoiLuong: async (b, g) => { daVa.push([b, g]); return b; },
    ...o,
  });
  return { phien, tracks, ketThuc, daVa, giay, recorder: () => BoGhiGia.daTao.at(-1)! };
}

// ---------------------------------------------------------------- kich ban #51

test('#51 luong dung giua buoi (track van live, recorder van recording): TU DUNG, KHONG luu, bao con', () => {
  const { phien, tracks, ketThuc, daVa, giay, recorder } = taoPhien();
  assert.equal(phien.batDau(), true);
  assert.equal(recorder().state, 'recording');

  camChay(phien, 8);                       // 8 s dau: khung toi deu
  assert.equal(ketThuc.length, 0);

  // Tu day camera DUNG: khong khung nao toi nua, nhung track van 'live', khong
  // mute, khong ended, recorder van 'recording' — dung nhu tren MacBook Safari.
  troi(NGUONG_LUONG_DUNG_MS - 1000);
  assert.equal(tracks[0].readyState, 'live');
  assert.equal(recorder().state, 'recording');
  assert.equal(ketThuc.length, 0, 'chua toi nguong thi chua phan xu');

  troi(1000);                              // du nguong o tick nay
  assert.equal(ketThuc.length, 1, 'tu dung dung mot lan');
  assert.equal(ketThuc[0].lyDo, 'gian-doan');
  assert.equal(ketThuc[0].clip, null, 'KHONG co clip nao duoc giao ra');
  assert.deepEqual(daVa, [], 'khong va thoi luong — khong co gi de luu');
  assert.equal(recorder().state, 'inactive', 'recorder da bi dung');
  assert.ok(tracks.every((t) => t.readyState === 'ended'), 'camera da tat');
  assert.equal(giay.at(-1), 12, 'dong ho dem toi luc dung (8 s chay + 4 s dung)');

  // Con bam "Quay xong" muon: khong hoi sinh duoc phien da bo
  phien.dung(false);
  troi(3000);
  assert.equal(ketThuc.length, 1);

  // Cau con doc: co o ban goc va ca ba tu dien
  const cau = CAU_BAO_KET_THUC['gian-doan'];
  assert.equal(
    T_VI(cau),
    'Máy quay bị gián đoạn giữa chừng nên bản này chưa lưu. Con mở máy quay và quay lại nhé.'
  );
  for (const td of Object.values(TU_DIEN)) assert.ok(td[cau], 'thieu ban dich cau bao gian doan');
});

test('khung den deu thi khong bao gio bi coi la dung; bam "Quay xong" ra clip da va thoi luong', async () => {
  const { phien, ketThuc, daVa, recorder } = taoPhien();
  phien.batDau();
  camChay(phien, 60);
  assert.equal(ketThuc.length, 0);

  phien.dung(false);
  assert.equal(recorder().state, 'inactive');
  await choMicrotask();
  assert.equal(ketThuc.length, 1);
  assert.equal(ketThuc[0].lyDo, 'xong');
  assert.ok(ketThuc[0].clip instanceof Blob);
  assert.equal(ketThuc[0].clip!.type, 'video/mp4');
  assert.equal(daVa.length, 1);
  assert.equal(daVa[0][1], 60, 'va bang so giay dong ho dem duoc');
});

test('tab an: khong phan xu trong luc an; hien lai thi tinh nguong tu dau', () => {
  const { phien, ketThuc } = taoPhien();
  phien.batDau();
  camChay(phien, 5);

  hien = false;                            // con chuyen tab: rVFC im lang du camera chay
  troi(20_000);
  assert.equal(ketThuc.length, 0, 'an 20 s khong co nhip ma khong bao dung');

  hien = true;                             // quay lai, camera van chay
  camChay(phien, 3);
  assert.equal(ketThuc.length, 0);

  troi(NGUONG_LUONG_DUNG_MS - 1000);
  assert.equal(ketThuc.length, 0, 'hien lai roi thi nguong moi bat dau tinh');
  troi(1000);
  assert.equal(ketThuc[0]?.lyDo, 'gian-doan', 'hien ma van khong khung -> dung that');
});

test('luong chinh bi nghen (tick den muon): tick do khong phan xu, camera chay tiep thi binh thuong', () => {
  const { phien, ketThuc } = taoPhien();
  phien.batDau();
  camChay(phien, 3);

  // Trang bi dong bang 6 s: ca rVFC lan setInterval deu khong chay, roi MOT
  // tick den muon — khong duoc coi 6 s do la camera dung.
  now += 6000;
  mock.timers.tick(1000);
  assert.equal(ketThuc.length, 0);

  camChay(phien, 5);
  assert.equal(ketThuc.length, 0);
});

test('track ended giua buoi: gian doan ngay, khong luu', () => {
  const { phien, tracks, ketThuc, daVa } = taoPhien();
  phien.batDau();
  camChay(phien, 3);
  tracks[0].end();
  assert.equal(ketThuc.length, 1);
  assert.equal(ketThuc[0].lyDo, 'gian-doan');
  assert.deepEqual(daVa, []);
});

test('track mute keo dai qua nguong: gian doan; mute ngan roi unmute: bo qua', () => {
  {
    const { phien, tracks, ketThuc } = taoPhien();
    phien.batDau();
    camChay(phien, 3);
    tracks[1].mute();                      // mic tam ngat 2 s roi tro lai
    camChay(phien, 2);
    tracks[1].unmute();
    camChay(phien, 10);
    assert.equal(ketThuc.length, 0, 'mute ngan khong phai dung');
  }
  {
    const { phien, tracks, ketThuc } = taoPhien();
    phien.batDau();
    camChay(phien, 3);
    tracks[1].mute();                      // mic mute mai, hinh van toi
    camChay(phien, NGUONG_LUONG_DUNG_MS / 1000 + 1);
    assert.equal(ketThuc[0]?.lyDo, 'gian-doan', 'mot track mute qua nguong = luong hong');
  }
});

test('khung xem truoc khong chieu (cuon ra khoi vung nhin / play() bi tu choi): KHONG dung, KHONG vut ban quay', () => {
  let chieu = true;
  const { phien, tracks, ketThuc, daVa, recorder } = taoPhien({ khungDangChieu: () => chieu });
  phien.batDau();
  camChay(phien, 3);

  // Con cuon len doc lai de bai: the <video> ra khoi vung nhin nen rVFC im lang,
  // nhung camera VAN sinh khung — tab van hien, tick van dung gio.
  chieu = false;
  troi(30_000);
  assert.equal(ketThuc.length, 0, 'khung khong chieu thi khong co nhip khong noi gi ve camera');
  assert.equal(recorder().state, 'recording', 'van dang quay');
  assert.ok(tracks.every((t) => t.readyState === 'live'), 'khong tat camera');
  assert.deepEqual(daVa, []);

  // Cuon xuong lai: nguong tinh tu luc quan sat duoc, va cu dung THAT van bat.
  chieu = true;
  camChay(phien, 3);
  assert.equal(ketThuc.length, 0);
  troi(NGUONG_LUONG_DUNG_MS);
  assert.equal(ketThuc[0]?.lyDo, 'gian-doan', 'khung dang chieu ma khong co nhip -> dung that');
});

test('khung xem truoc khong chieu: mute/ended cua track VAN phan xu (tin hieu tu camera)', () => {
  {
    const { phien, tracks, ketThuc } = taoPhien({ khungDangChieu: () => false });
    phien.batDau();
    troi(3000);
    tracks[0].mute();
    troi(NGUONG_LUONG_DUNG_MS + 1000);
    assert.equal(ketThuc[0]?.lyDo, 'gian-doan', 'mute qua nguong khong phu thuoc khung xem truoc');
  }
  {
    const { phien, tracks, ketThuc } = taoPhien({ khungDangChieu: () => false });
    phien.batDau();
    troi(3000);
    tracks[0].end();
    assert.equal(ketThuc[0]?.lyDo, 'gian-doan');
  }
});

test('moc mute theo TUNG track: track nay unmute khong xoa moc cua track kia dang con mute', () => {
  const { phien, tracks, ketThuc } = taoPhien();
  phien.batDau();
  camChay(phien, 2);
  tracks[1].mute();                        // mic chet o t=0, khong bao gio tro lai
  camChay(phien, 1);
  tracks[0].mute();                        // hinh ngat o t=1
  camChay(phien, 1);
  tracks[0].unmute();                      // hinh tro lai o t=2 — mic VAN mute
  camChay(phien, 1);
  assert.equal(ketThuc.length, 0, 'chua du nguong tu luc mic mute');
  camChay(phien, 1);
  assert.equal(ketThuc[0]?.lyDo, 'gian-doan', 'mic mute qua nguong van la gian doan');
  assert.equal(ketThuc[0]?.clip, null);
});

test('trinh duyet khong co rVFC (theoDoiKhung=false): khong co nhip cung khong bao dung, van bat mute/ended', () => {
  const { phien, tracks, ketThuc } = taoPhien({ theoDoiKhung: false });
  phien.batDau();
  troi(30_000);                            // khong ai goi nhipKhung
  assert.equal(ketThuc.length, 0, 'khong co nguon nhip thi khong duoc doan la dung');
  tracks[0].mute();
  troi(NGUONG_LUONG_DUNG_MS + 1000);
  assert.equal(ketThuc[0]?.lyDo, 'gian-doan');
});

test('recorder tu dung / bao loi khi ta chua dung: gian doan, khong tin ban ghi', async () => {
  {
    const { phien, ketThuc, recorder } = taoPhien();
    phien.batDau();
    camChay(phien, 2);
    recorder().stop();                     // trinh duyet tu dung recorder
    await choMicrotask();
    assert.equal(ketThuc[0]?.lyDo, 'gian-doan');
    assert.equal(ketThuc.length, 1);
  }
  {
    const { phien, ketThuc, recorder } = taoPhien();
    phien.batDau();
    recorder().onerror?.({});
    assert.equal(ketThuc[0]?.lyDo, 'gian-doan');
  }
});

test('huy: ve tay khong, khong loi; boRoi (roi trang): khong goi onKetThuc, van tat camera', () => {
  {
    const { phien, tracks, ketThuc, daVa } = taoPhien();
    phien.batDau();
    camChay(phien, 2);
    phien.dung(true);
    assert.deepEqual(ketThuc.map((k) => k.lyDo), ['huy']);
    assert.deepEqual(daVa, []);
    assert.ok(tracks.every((t) => t.readyState === 'ended'));
  }
  {
    const { phien, tracks, ketThuc, recorder } = taoPhien();
    phien.batDau();
    camChay(phien, 2);
    phien.boRoi();
    assert.equal(ketThuc.length, 0);
    assert.equal(recorder().state, 'inactive');
    assert.ok(tracks.every((t) => t.readyState === 'ended'));
  }
});

test('het gio (maxGiay): tu chot nhu bam "Quay xong"', async () => {
  const { phien, ketThuc } = taoPhien({ maxGiay: 5 });
  phien.batDau();
  camChay(phien, 5);
  await choMicrotask();
  assert.equal(ketThuc[0]?.lyDo, 'xong');
  assert.equal(ketThuc[0]?.giay, 5);
});

test('va thoi luong hong: van goi onKetThuc, giao clip GOC voi ly do "xong" (khong mat ban ghi, khong treo phien)', async () => {
  const { phien, ketThuc } = taoPhien({
    vaThoiLuong: async () => { throw new RangeError('mp4 la: doc qua bien'); },
  });
  phien.batDau();
  camChay(phien, 4);
  phien.dung(false);
  await choMicrotask();
  assert.equal(ketThuc.length, 1, 'khong bao gio de phien ket thuc ma khong goi onKetThuc');
  assert.equal(ketThuc[0].lyDo, 'xong');
  assert.ok(ketThuc[0].clip instanceof Blob, 'ban ghi goc duoc giao ra');
  assert.equal(ketThuc[0].clip!.size, 16);
  assert.equal(ketThuc[0].giay, 4);
});

test('dung binh thuong ma khong co byte nao: "trong"', async () => {
  const { phien, ketThuc, recorder } = taoPhien();
  phien.batDau();
  camChay(phien, 2);
  recorder().stop = function (this: BoGhiGia) { this.state = 'inactive'; queueMicrotask(() => this.onstop?.()); };
  phien.dung(false);
  await choMicrotask();
  assert.equal(ketThuc[0]?.lyDo, 'trong');
  assert.equal(T_VI(CAU_BAO_KET_THUC['trong']), 'Chưa quay được gì, con thử lại nhé.');
});

test('khong ghi duoc: constructor hoac start() nem -> "khong-ghi-duoc", camera tat, batDau tra false', () => {
  for (const cho of ['tao', 'start'] as const) {
    BoGhiGia.nemLucTao = cho === 'tao';
    BoGhiGia.nemLucStart = cho === 'start';
    const { phien, tracks, ketThuc } = taoPhien();
    assert.equal(phien.batDau(), false);
    assert.equal(ketThuc[0]?.lyDo, 'khong-ghi-duoc');
    assert.ok(tracks.every((t) => t.readyState === 'ended'));
  }
  assert.equal(
    T_VI(CAU_BAO_KET_THUC['khong-ghi-duoc']),
    'Máy này chưa quay video trong trang được. Con nhờ bố mẹ mở bằng Safari hoặc Chrome mới hơn nhé.'
  );
});

test('bam dung lan hai trong cua so cho onstop bi bo qua (khong hoi sinh, khong doi ly do)', async () => {
  const { phien, ketThuc } = taoPhien();
  phien.batDau();
  camChay(phien, 2);
  phien.dung(false);
  phien.dung(true);                        // bam "Huỷ" ngay sau "Quay xong"
  await choMicrotask();
  assert.deepEqual(ketThuc.map((k) => k.lyDo), ['xong']);
});

test('mimeType: chon ung vien dau tien may ho tro, kem bitrate', () => {
  const { phien, recorder } = taoPhien({ videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 96_000 });
  phien.batDau();
  assert.deepEqual(recorder().options, {
    mimeType: 'video/mp4;codecs=avc1', videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 96_000,
  });
});

// ---------------------------------------------------------------- mo camera that bai

test('mo camera that bai: moi ca mot cau con doc duoc, noi ro phai lam gi', () => {
  const ca: [unknown, keyof typeof CAU_BAO_MO_CAMERA, string][] = [
    [new DOMException('Permission denied', 'NotAllowedError'), 'tu-choi',
      'Máy chưa cho phép dùng máy quay. Con nhờ bố mẹ bấm "Cho phép" khi máy hỏi, rồi thử lại nhé.'],
    [new DOMException('Requested device not found', 'NotFoundError'), 'khong-co',
      'Không tìm thấy máy quay trên máy này. Con dùng iPad hoặc máy có máy quay nhé.'],
    [new DOMException('Could not start video source', 'NotReadableError'), 'dang-ban',
      'Máy quay đang bận vì ứng dụng khác đang dùng. Con tắt ứng dụng đó rồi thử lại nhé.'],
    [new TypeError('boom'), 'khac', 'Chưa mở được máy quay. Con thử lại, hoặc nhờ bố mẹ giúp nhé.'],
    [undefined, 'khac', 'Chưa mở được máy quay. Con thử lại, hoặc nhờ bố mẹ giúp nhé.'],
  ];
  for (const [loi, loai, cau] of ca) {
    assert.equal(phanLoaiLoiMoCamera(loi), loai);
    assert.equal(T_VI(CAU_BAO_MO_CAMERA[loai]), cau);
    for (const td of Object.values(TU_DIEN)) assert.ok(td[CAU_BAO_MO_CAMERA[loai]], `thieu ban dich: ${cau}`);
  }
  // Ten cu cua Chrome doi truoc
  assert.equal(phanLoaiLoiMoCamera({ name: 'PermissionDeniedError' }), 'tu-choi');
  assert.equal(phanLoaiLoiMoCamera({ name: 'DevicesNotFoundError' }), 'khong-co');
  assert.equal(phanLoaiLoiMoCamera({ name: 'OverconstrainedError' }), 'khong-co');
});

// ---------------------------------------------------------------- noi rVFC

test('noiNhipKhung: moi khung mot nhip va dang ky lai; go thi thoi', () => {
  let cb: (() => void) | null = null;
  let daHuy = -1;
  let id = 0;
  const video = {
    requestVideoFrameCallback: (f: () => void) => { cb = f; return ++id; },
    cancelVideoFrameCallback: (i: number) => { daHuy = i; },
  } as unknown as HTMLVideoElement;
  let nhip = 0;
  assert.equal(hoTroNhipKhung(video), true);
  assert.equal(hoTroNhipKhung(null), false);
  assert.equal(hoTroNhipKhung({} as HTMLVideoElement), false);

  const go = noiNhipKhung(video, { nhipKhung: () => nhip++ });
  cb!(); cb!(); cb!();
  assert.equal(nhip, 3);
  assert.equal(id, 4, 'dang ky lai sau moi khung');
  go();
  assert.equal(daHuy, 4);
  cb!();
  assert.equal(nhip, 3, 'da go thi khung toi cung khong tinh');
});

test('theoDoiKhungChieu: dang chieu = vua trong vung nhin vua dang chay', () => {
  const goc = globalThis.IntersectionObserver;
  let bao: ((ds: { isIntersecting: boolean }[]) => void) | null = null;
  let daQuanSat: unknown = null;
  let daNgat = false;
  globalThis.IntersectionObserver = class {
    constructor(f: (ds: { isIntersecting: boolean }[]) => void) { bao = f; }
    observe(el: unknown) { daQuanSat = el; }
    disconnect() { daNgat = true; }
  } as unknown as typeof IntersectionObserver;
  try {
    const video = { paused: false, ended: false } as HTMLVideoElement;
    const canh = theoDoiKhungChieu(video);
    assert.equal(daQuanSat, video);
    assert.equal(canh.dangChieu(), true, 'chua co bao cao nao thi coi nhu dang chieu');

    bao!([{ isIntersecting: false }]);
    assert.equal(canh.dangChieu(), false, 'ra khoi vung nhin');
    bao!([{ isIntersecting: true }]);
    assert.equal(canh.dangChieu(), true);

    (video as { paused: boolean }).paused = true;   // play() bi tu choi
    assert.equal(canh.dangChieu(), false, 'khung khong chay thi rVFC im mai mai');
    (video as { paused: boolean }).paused = false;
    (video as { ended: boolean }).ended = true;
    assert.equal(canh.dangChieu(), false);

    canh.go();
    assert.equal(daNgat, true);
  } finally {
    globalThis.IntersectionObserver = goc;
  }
});

test('theoDoiKhungChieu: may khong co IntersectionObserver thi coi nhu dang chieu (khong tat hang rao)', () => {
  const goc = globalThis.IntersectionObserver;
  Reflect.deleteProperty(globalThis, 'IntersectionObserver');   // may khong ho tro
  try {
    const canh = theoDoiKhungChieu({ paused: false, ended: false } as HTMLVideoElement);
    assert.equal(canh.dangChieu(), true);
    canh.go();
  } finally {
    globalThis.IntersectionObserver = goc;
  }
});
