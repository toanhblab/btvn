/**
 * Sua metadata thoi luong trong video con vua quay xong (issue #32).
 *
 * MediaRecorder ghi video KIEU STREAMING — luc bat dau ghi no chua biet tong
 * se dai bao lau, nen container (mp4 hoac webm) thuong mang mot gia tri
 * duration SAI trong header: 0, Infinity, hoac dung dung khoang thoi gian cua
 * doan dau tien ma bo ma hoa da biet luc du lieu duoc "chot" (day la loi ban
 * than trinh duyet/webkit, khong phai loi ghep chunk cua ta — chunksRef gom du
 * toan bo du lieu, chi mois truong SO trong header header la sai).
 *
 * Trong trang, <video> van PHAT du toan bo noi dung (issue mo ta "video tren
 * app la 3 phut") vi trinh duyet doc du lieu thuc te khi tua, khong dung mai
 * gia tri duration de cat. Nhung bat ky cong cu nao khac DOC METADATA de quyet
 * dinh do dai — nhu buoc nhap video vao thu vien Anh cua iOS khi bam "Save
 * Video" tren bang chia se — se cat theo con so sai do (video 3 phut chi con
 * hon 1 phut).
 *
 * Ta biet CHINH XAC thoi luong that: dong ho da dem duoc trong luc ghi
 * (elapsedRef trong QuayVideo). Sau khi ghep xong Blob, ghi de gia tri
 * duration trong container bang so that do — chi vá 4-8 byte trong header,
 * khong dung toi hinh/am, khong can thu vien remux nao.
 *
 * Chi VA TRI CHO SAN (khong doi kich thuoc tep): neu container khong co san
 * truong duration (hiem, nhung co the xay ra) thi bo qua, tra nguyen Blob goc
 * — an toan hon la chen them byte va phai tinh lai moi offset phia sau.
 *
 * MOI TRACK MANG THOI LUONG RIENG CUA NO (nguon: dieu tra
 * data/btvn-video-mau-that/report.md, tiep noi data/btvn-video-qua-dai).
 * Ban dau ham nay ghi CUNG mot `seconds` (elapsedRef tong the) vao mvhd VA
 * vao tkhd/mdhd cua MOI track no gap — khong phan biet track nao that su dai
 * bao nhieu. Tren mot file that (audio ~24s du lieu mau, video ~326s, ca hai
 * bi vá thanh cung 325s), Safari/AVFoundation hien thi 650s = tong 2 track
 * cung gia tri do (Chrome thi lay max nen khong lo). mvhd (chi mot gia tri
 * cho ca phim) VAN dung `seconds` chung nhu cu — dung nghia la tong the.
 * tkhd/mdhd cua TUNG track gio tinh tu tong `sample_duration` trong cac hop
 * `trun` (thuoc `moof > traf`, khop `tfhd.trackId` that) — thoi luong mau
 * that, doc lap voi header — roi ghi RIENG vao dung track do. Neu file khong
 * phan manh (khong co moof/trun, vi du webm hoac mp4 khong tu MediaRecorder)
 * hoac thieu du lieu track, roi ve dung `seconds` chung nhu truoc — khong pha
 * duong Chrome dang chay dung.
 */

function readUintBE(view: DataView, offset: number, length: number): number {
  let v = 0;
  for (let i = 0; i < length; i++) v = v * 256 + view.getUint8(offset + i);
  return v;
}

function writeUintBE(view: DataView, offset: number, length: number, value: number): void {
  let v = value;
  for (let i = length - 1; i >= 0; i--) {
    view.setUint8(offset + i, v % 256);
    v = Math.floor(v / 256);
  }
}

// ---------------------------------------------------------------- MP4/ISOBMFF

function boxType(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset), view.getUint8(offset + 1),
    view.getUint8(offset + 2), view.getUint8(offset + 3)
  );
}

/** offset con truoc "version+flags" cua mvhd/tkhd/mdhd — tra ve size cua truong thoi gian (4 hoac 8 byte). */
function timeFieldSize(view: DataView, body: number): number {
  return view.getUint8(body) === 1 ? 8 : 4;
}

/** version(1 byte) + flags(3 byte) cua mot full box (vd tfhd/trun). */
function fullBoxVersionFlags(view: DataView, body: number): { version: number; flags: number } {
  const v = readUintBE(view, body, 4);
  return { version: v >>> 24, flags: v & 0xffffff };
}

/** Duyet cac box con truc tiep trong [start, end), goi visit(type, offset, headerSize, boxSize) cho tung box. */
function forEachBox(
  view: DataView,
  start: number,
  end: number,
  visit: (type: string, offset: number, headerSize: number, boxSize: number) => void
): void {
  let offset = start;
  while (offset + 8 <= end) {
    const size32 = readUintBE(view, offset, 4);
    const type = boxType(view, offset + 4);
    let boxSize = size32;
    let headerSize = 8;
    if (size32 === 1) {
      if (offset + 16 > end) break;
      boxSize = readUintBE(view, offset + 8, 8);
      headerSize = 16;
    } else if (size32 === 0) {
      boxSize = end - offset; // box chay den het cha
    }
    if (boxSize < headerSize || offset + boxSize > end) break; // du lieu bat thuong, dung an toan
    visit(type, offset, headerSize, boxSize);
    offset += boxSize;
  }
}

/** Doc tkhd.track_ID -> mdhd.timescale cua tung track trong moov (mdhd co timescale rieng, tkhd thi khong). */
function collectTrackTimescales(view: DataView, totalLength: number): Map<number, number> {
  const trackTimescales = new Map<number, number>();
  let currentTrackId: number | null = null;

  function walk(start: number, end: number): void {
    forEachBox(view, start, end, (type, offset, headerSize, boxSize) => {
      if (type === 'moov' || type === 'trak' || type === 'mdia') {
        walk(offset + headerSize, offset + boxSize);
      } else if (type === 'tkhd') {
        const body = offset + headerSize;
        const tSize = timeFieldSize(view, body);
        currentTrackId = readUintBE(view, body + 4 + tSize * 2, 4);
      } else if (type === 'mdhd') {
        const body = offset + headerSize;
        const tSize = timeFieldSize(view, body);
        const timescale = readUintBE(view, body + 4 + tSize * 2, 4);
        if (currentTrackId !== null && timescale > 0) trackTimescales.set(currentTrackId, timescale);
      }
    });
  }
  walk(0, totalLength);
  return trackTimescales;
}

/**
 * Cong don `sample_duration` trong moi hop `trun` (thuoc `moof > traf`) theo
 * dung `tfhd.trackId` — thoi luong mau THAT cua tung track, doc lap voi
 * mvhd/tkhd/mdhd (nhung hop nay co the da bi vá sai). Tra ve rong neu file
 * khong phan manh (khong co moof/trun) — mp4 khong do MediaRecorder ghi, hoac
 * MediaRecorder cua mot so trinh duyet/che do khac ghi kieu "phang".
 */
function collectTrackSampleSums(view: DataView, totalLength: number): Map<number, number> {
  const sums = new Map<number, number>();

  function walkTraf(start: number, end: number): void {
    let trackId: number | null = null;
    let defaultSampleDuration = 0;
    forEachBox(view, start, end, (type, offset, headerSize) => {
      if (type === 'tfhd') {
        const body = offset + headerSize;
        const { flags } = fullBoxVersionFlags(view, body);
        let p = body + 4; // version+flags(4), roi toi track_ID
        trackId = readUintBE(view, p, 4);
        p += 4;
        if (flags & 0x000001) p += 8; // base-data-offset-present
        if (flags & 0x000002) p += 4; // sample-description-index-present
        if (flags & 0x000008) defaultSampleDuration = readUintBE(view, p, 4); // default-sample-duration-present
      } else if (type === 'trun' && trackId !== null) {
        const body = offset + headerSize;
        const { flags } = fullBoxVersionFlags(view, body);
        const sampleCount = readUintBE(view, body + 4, 4);
        let p = body + 8;
        if (flags & 0x000001) p += 4; // data-offset-present
        if (flags & 0x000004) p += 4; // first-sample-flags-present
        const durationPresent = (flags & 0x000100) !== 0;
        const sizePresent = (flags & 0x000200) !== 0;
        const flagsPresent = (flags & 0x000400) !== 0;
        const ctsPresent = (flags & 0x000800) !== 0;

        let sum = sums.get(trackId) ?? 0;
        for (let i = 0; i < sampleCount; i++) {
          if (durationPresent) {
            sum += readUintBE(view, p, 4);
            p += 4;
          } else {
            sum += defaultSampleDuration;
          }
          if (sizePresent) p += 4;
          if (flagsPresent) p += 4;
          if (ctsPresent) p += 4;
        }
        sums.set(trackId, sum);
      }
    });
  }

  function walkMoof(start: number, end: number): void {
    forEachBox(view, start, end, (type, offset, headerSize, boxSize) => {
      if (type === 'traf') walkTraf(offset + headerSize, offset + boxSize);
    });
  }

  forEachBox(view, 0, totalLength, (type, offset, headerSize, boxSize) => {
    if (type === 'moof') walkMoof(offset + headerSize, offset + boxSize);
  });

  return sums;
}

/**
 * Duyet cay box MP4 (ISO/IEC 14496-12), vá truong duration trong mvhd + tung
 * tkhd + mdhd. mvhd (chi mot gia tri cho ca phim) dung `seconds` chung
 * (elapsedRef tong the) nhu cu. tkhd/mdhd cua TUNG track dung thoi luong mau
 * THAT rieng cua chinh track do (tinh tu moof/trun, xem collectTrackSampleSums)
 * khi tinh duoc; neu khong (file khong phan manh, hoac thieu du lieu track)
 * thi roi ve `seconds` chung nhu hanh vi cu. mdhd.duration cung timescale voi
 * chinh no nen dung thang tong don vi mau (chinh xac tuyet doi, khong quy doi
 * qua giay); tkhd.duration lai theo timescale cua PHIM (mvhd) nen phai quy doi
 * tu don vi mau that (theo timescale track) sang giay roi nhan lai
 * movieTimescale — vi the phai doc mvhd TRUOC roi moi vá cac trak, dung thu tu
 * box trong file (mvhd luon dung truoc cac trak trong moov theo chuan).
 */
function patchMp4Duration(buf: ArrayBuffer, seconds: number): boolean {
  const view = new DataView(buf);
  let changed = false;

  const trackTimescales = collectTrackTimescales(view, buf.byteLength);
  const trackSampleUnitSums = collectTrackSampleSums(view, buf.byteLength);

  let movieTimescale = 0;
  let currentTrackId: number | null = null;

  function walk(start: number, end: number): void {
    forEachBox(view, start, end, (type, offset, headerSize, boxSize) => {
      if (type === 'moov' || type === 'trak' || type === 'mdia') {
        walk(offset + headerSize, offset + boxSize);
      } else if (type === 'mvhd') {
        const body = offset + headerSize;
        const tSize = timeFieldSize(view, body);
        const timescaleOffset = body + 4 + tSize * 2; // version+flags(4) + creation + modification
        movieTimescale = readUintBE(view, timescaleOffset, 4);
        if (movieTimescale > 0) {
          writeUintBE(view, timescaleOffset + 4, tSize, Math.round(seconds * movieTimescale));
          changed = true;
        }
      } else if (type === 'tkhd') {
        const body = offset + headerSize;
        const tSize = timeFieldSize(view, body);
        // version+flags(4) + creation + modification + track_ID(4) + reserved(4)
        const trackIdOffset = body + 4 + tSize * 2;
        currentTrackId = readUintBE(view, trackIdOffset, 4);
        const durationOffset = trackIdOffset + 4 + 4;
        if (movieTimescale > 0) {
          const trackTimescale = trackTimescales.get(currentTrackId);
          const rawUnits = trackSampleUnitSums.get(currentTrackId);
          const trackSeconds =
            trackTimescale !== undefined && rawUnits !== undefined ? rawUnits / trackTimescale : null;
          writeUintBE(view, durationOffset, tSize, Math.round((trackSeconds ?? seconds) * movieTimescale));
          changed = true;
        }
      } else if (type === 'mdhd') {
        const body = offset + headerSize;
        const tSize = timeFieldSize(view, body);
        const timescaleOffset = body + 4 + tSize * 2;
        const timescale = readUintBE(view, timescaleOffset, 4);
        if (timescale > 0) {
          const rawUnits = currentTrackId !== null ? trackSampleUnitSums.get(currentTrackId) : undefined;
          const value = rawUnits !== undefined ? rawUnits : Math.round(seconds * timescale);
          writeUintBE(view, timescaleOffset + 4, tSize, value);
          changed = true;
        }
      }
    });
  }

  walk(0, buf.byteLength);
  return changed;
}

// ---------------------------------------------------------------------- WebM

const EBML_ID_SEGMENT = 0x18538067;
const EBML_ID_INFO = 0x1549a966;
const EBML_ID_TIMECODE_SCALE = 0x2ad7b1;
const EBML_ID_DURATION = 0x4489;

function vintLength(firstByte: number): number {
  if (firstByte === 0) return 0; // khong hop le trong EBML that
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && !(firstByte & mask)) {
    length++;
    mask >>= 1;
  }
  return length <= 8 ? length : 0;
}

/** Doc ID phan tu EBML — GIU nguyen bit danh dau do dai, vi cac hang ID chuan (nhu 0x4489) da tinh ca bit do. */
function readVintId(view: DataView, offset: number): { length: number; value: number } | null {
  const length = vintLength(view.getUint8(offset));
  if (!length) return null;
  let value = view.getUint8(offset);
  for (let i = 1; i < length; i++) value = value * 256 + view.getUint8(offset + i);
  return { length, value };
}

/** Doc kich thuoc phan tu EBML — BO bit danh dau. value = null nghia la "kich thuoc chua biet". */
function readVintSize(view: DataView, offset: number): { length: number; value: number | null } | null {
  const first = view.getUint8(offset);
  const length = vintLength(first);
  if (!length) return null;
  const marker = 0x80 >> (length - 1);
  let value = first & (marker - 1);
  let allOnes = value === marker - 1;
  for (let i = 1; i < length; i++) {
    const b = view.getUint8(offset + i);
    value = value * 256 + b;
    if (b !== 0xff) allOnes = false;
  }
  return { length, value: allOnes ? null : value };
}

/** Tim phan tu con dau tien co ID = targetId, ngay duoi cap [start, end). */
function findChild(
  view: DataView,
  start: number,
  end: number,
  targetId: number
): { start: number; end: number } | null {
  let offset = start;
  while (offset < end) {
    const id = readVintId(view, offset);
    if (!id) return null;
    const sizeOffset = offset + id.length;
    if (sizeOffset >= end) return null;
    const size = readVintSize(view, sizeOffset);
    if (!size) return null;
    const dataStart = sizeOffset + size.length;
    const dataEnd = size.value === null ? end : dataStart + size.value;
    if (dataEnd > end || dataStart > dataEnd) return null;
    if (id.value === targetId) return { start: dataStart, end: dataEnd };
    offset = dataEnd;
  }
  return null;
}

/**
 * Vá phan tu Duration co san trong Segment > Info. KHONG chen moi khi thieu:
 * Chrome ln truoc cho no san mot o co dinh (thuong 8 byte, kieu float) ngay tu
 * luc bat dau ghi de sau nay dien lai — day chinh la truong hop ta vá duoc an
 * toan, khong doi kich thuoc tep.
 */
function patchWebmDuration(buf: ArrayBuffer, seconds: number): boolean {
  const view = new DataView(buf);
  const segment = findChild(view, 0, buf.byteLength, EBML_ID_SEGMENT);
  if (!segment) return false;
  const info = findChild(view, segment.start, segment.end, EBML_ID_INFO);
  if (!info) return false;
  const durationEl = findChild(view, info.start, info.end, EBML_ID_DURATION);
  if (!durationEl) return false;

  const scaleEl = findChild(view, info.start, info.end, EBML_ID_TIMECODE_SCALE);
  const timecodeScale = scaleEl
    ? readUintBE(view, scaleEl.start, scaleEl.end - scaleEl.start)
    : 1_000_000; // mac dinh cua Matroska: 1 don vi = 1ms

  const size = durationEl.end - durationEl.start;
  const durationUnits = (seconds * 1e9) / timecodeScale;
  if (size === 8) view.setFloat64(durationEl.start, durationUnits);
  else if (size === 4) view.setFloat32(durationEl.start, durationUnits);
  else return false;
  return true;
}

/**
 * Vá metadata thoi luong cua mot Blob video mp4/webm bang so giay THAT (do
 * chinh app minh dem duoc luc ghi). Tra ve Blob moi neu vá duoc, hoac nguyen
 * Blob dau vao neu khong nhan dien duoc container hay khong tim thay cho de vá.
 */
export async function fixVideoDuration(blob: Blob, durationSeconds: number): Promise<Blob> {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return blob;

  const isMp4 = blob.type.includes('mp4');
  const isWebm = blob.type.includes('webm');
  if (!isMp4 && !isWebm) return blob;

  const buf = await blob.arrayBuffer();
  const changed = isMp4 ? patchMp4Duration(buf, durationSeconds) : patchWebmDuration(buf, durationSeconds);
  return changed ? new Blob([buf], { type: blob.type }) : blob;
}
