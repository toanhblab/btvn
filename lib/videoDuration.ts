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

/**
 * Duyet cay box MP4 (ISO/IEC 14496-12), vá truong duration trong mvhd + tung
 * tkhd + mdhd bang thoi luong that. mvhd/mdhd co timescale RIENG cua no; tkhd
 * KHONG co timescale rieng, dung chung timescale cua phim (mvhd) — vi the phai
 * doc mvhd TRUOC roi moi vá cac trak, dung thu tu box trong file (mvhd luon
 * dung truoc cac trak trong moov theo chuan).
 */
function patchMp4Duration(buf: ArrayBuffer, seconds: number): boolean {
  const view = new DataView(buf);
  let changed = false;
  let movieTimescale = 0;

  function boxType(offset: number): string {
    return String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3)
    );
  }

  /** offset con truoc "version+flags" cua mvhd/tkhd/mdhd — tra ve size cua truong thoi gian (4 hoac 8 byte). */
  function timeFieldSize(body: number): number {
    return view.getUint8(body) === 1 ? 8 : 4;
  }

  function walk(start: number, end: number): void {
    let offset = start;
    while (offset + 8 <= end) {
      const size32 = readUintBE(view, offset, 4);
      const type = boxType(offset + 4);
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

      if (type === 'moov' || type === 'trak' || type === 'mdia') {
        walk(offset + headerSize, offset + boxSize);
      } else if (type === 'mvhd') {
        const body = offset + headerSize;
        const tSize = timeFieldSize(body);
        const timescaleOffset = body + 4 + tSize * 2; // version+flags(4) + creation + modification
        movieTimescale = readUintBE(view, timescaleOffset, 4);
        if (movieTimescale > 0) {
          writeUintBE(view, timescaleOffset + 4, tSize, Math.round(seconds * movieTimescale));
          changed = true;
        }
      } else if (type === 'tkhd') {
        const body = offset + headerSize;
        const tSize = timeFieldSize(body);
        // version+flags(4) + creation + modification + track_ID(4) + reserved(4)
        const durationOffset = body + 4 + tSize * 2 + 4 + 4;
        if (movieTimescale > 0) {
          writeUintBE(view, durationOffset, tSize, Math.round(seconds * movieTimescale));
          changed = true;
        }
      } else if (type === 'mdhd') {
        const body = offset + headerSize;
        const tSize = timeFieldSize(body);
        const timescaleOffset = body + 4 + tSize * 2;
        const timescale = readUintBE(view, timescaleOffset, 4);
        if (timescale > 0) {
          writeUintBE(view, timescaleOffset + 4, tSize, Math.round(seconds * timescale));
          changed = true;
        }
      }
      offset += boxSize;
    }
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
