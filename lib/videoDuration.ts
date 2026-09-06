/**
 * Sua metadata thoi luong trong video con vua quay xong (issue #32, va loi
 * Safari hien thi GAP DOI — xem "Hop mehd" ben duoi).
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
 * duration trong container bang so that do — vá 4-8 byte trong header, khong
 * dung toi hinh/am, khong can thu vien remux nao.
 *
 * HAI TANG VA, MUC DO RUI RO KHAC NHAU:
 *
 * 1. Vá TAI CHO (khong doi kich thuoc tep): mvhd/tkhd/mdhd (mp4) va
 *    Segment>Info>Duration (webm). Chi ghi de so vao o co san. Neu container
 *    khong co san o do thi bo qua. Day la tang an toan tuyet doi, luon chay.
 *
 * 2. CHEN THEM hop `mvex > mehd` (mp4 phan manh) — doi kich thuoc tep, phai
 *    tinh lai MOI offset tuyet doi phia sau cho chen. Tang nay chi chay khi
 *    phan tich duoc TOAN BO cay hop theo danh sach trang (whitelist) hop da
 *    biet; gap bat ky hop la/cau truc bat thuong nao thi TU CHOI — tra ve ket
 *    qua cua tang 1 nguyen ven, khong bao gio xuat ra tep da dich offset do
 *    dang. Xem themMehd() ben duoi.
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
 *
 * HOP mehd — VI SAO PHAI CHEN THEM (nguon: data/btvn-video-mau-that-2/report.md).
 * Vá "moi track dung gia tri rieng" o tren CHAY DUNG 100% (kiem chung byte
 * tren file that) nhung KHONG het trieu chung gap doi tren Safari: mot video
 * binh thuong co 2 track dai gan bang nhau (~20.69s va ~20.65s), tong van ra
 * ~41s cho video 20s. File MediaRecorder cua Safari co `mvex` (danh dau movie
 * phan manh) nhung KHONG co `mvex > mehd` — hop khai bao thoi luong tong o cap
 * movie cho movie phan manh. Thieu con so tong dang tin do, AVFoundation roi
 * vao nhanh cong don thoi luong cac track. Chen `mehd` mang `fragment_duration`
 * = thoi luong track dai nhat (theo timescale cua mvhd) cho Safari mot con so
 * tong de doc thay vi tu cong. Chrome khong doc mehd nen khong anh huong.
 *
 * GIOI HAN: chua kiem chung duoc tren Safari that (moi truong khong co driver
 * Safari) — chi kiem chung byte-level + Chrome van phat dung file sau khi chen.
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

// ------------------------------------------------ MP4: chen/ghi de mvex > mehd

/**
 * Chen (hoac ghi de) hop `mvex > mehd` mang thoi luong movie-level.
 *
 * Chen mot hop moi vao giua `moov` lam DICH CHUYEN moi byte phia sau no, nen
 * moi offset TUYET DOI trong tep tro vao vung phia sau cho chen phai cong them
 * dung `delta` byte. Trong tep MediaRecorder that (Safari va Chrome) nhung
 * offset tuyet doi nam o:
 *   - `stbl > stco` / `co64` (bang chunk offset, trong tung trak cua moov —
 *     tep phan manh thuong de trong, nhung van phai xu ly neu co entry);
 *   - `traf > tfhd.base_data_offset` khi co flag base-data-offset-present
 *     (0x000001). (Flag default-base-is-moof 0x020000 va `trun.data_offset`
 *     la TUONG DOI so voi dau moof nen khong can dich.)
 *   - `mfra > tfra.moof_offset` (Chrome ghi mfra o cuoi tep; Safari khong).
 *
 * QUY TAC AN TOAN — tha khong chen con hon chen hong: duyet TOAN BO cay hop
 * theo danh sach trang. Bat ky hop nao khong nam trong danh sach (vi du `meta`
 * co the chua `iloc`, `saio`, `sidx`, `uuid`, hop la trong `moov`/`moof`),
 * kich thuoc bat thuong, hop trung lap, offset tro ra ngoai tep, hay `tfra`
 * tro vao cho khong phai `moof` — deu TU CHOI: tra ve 'tu-choi' ma KHONG dong
 * gi vao `buf`. Nguoi goi giu nguyen ket qua vá tai cho (tang 1), video van
 * xem duoc, chi thieu mehd nhu truoc.
 *
 * Neu tep DA co `mehd` san thi chi ghi de gia tri tai cho — khong doi kich
 * thuoc, khong dich offset ('ghi-de'). Khong co `moov`/`mvex` (tep khong phan
 * manh) thi 'khong-can'.
 */
export type KetQuaMehd =
  | { kieu: 'chen'; buf: ArrayBuffer }
  | { kieu: 'ghi-de' }
  | { kieu: 'khong-can' }
  | { kieu: 'tu-choi'; lyDo: string };

class TuChoiChenMehd extends Error {}
function tuChoi(lyDo: string): never {
  throw new TuChoiChenMehd(lyDo);
}

interface ViTriHop {
  offset: number;
  headerSize: number;
  size: number;
}

/** Mot truong offset tuyet doi: vi tri truong trong tep, do rong (4|8 byte), gia tri hien tai. */
interface TruongOffset {
  pos: number;
  width: number;
  value: number;
}

/** Hop la (khong chua offset tuyet doi, khong can duyet vao), theo hop cha ('' = cap tep). */
const HOP_LA: Record<string, ReadonlySet<string>> = {
  '': new Set(['ftyp', 'mdat', 'free', 'skip', 'wide']),
  moov: new Set(['mvhd', 'iods']),
  trak: new Set(['tkhd', 'tref', 'edts']),
  mdia: new Set(['mdhd', 'hdlr', 'elng']),
  minf: new Set(['vmhd', 'smhd', 'hmhd', 'nmhd', 'sthd', 'dinf']),
  stbl: new Set([
    'stsd', 'stts', 'ctts', 'cslg', 'stsc', 'stsz', 'stz2', 'stss', 'stsh',
    'padb', 'stdp', 'sdtp', 'sbgp', 'sgpd', 'subs', 'saiz',
  ]),
  mvex: new Set(['trex', 'leva']),
  moof: new Set(['mfhd']),
  traf: new Set(['tfdt', 'trun', 'sbgp', 'sgpd', 'subs', 'saiz', 'senc']),
  mfra: new Set(['mfro']),
};

/** Hop cha can duyet tiep vao ben trong, theo hop cha. */
const HOP_DUYET: Record<string, ReadonlySet<string>> = {
  '': new Set(['moov', 'moof', 'mfra']),
  moov: new Set(['trak', 'mvex', 'udta']),
  trak: new Set(['mdia', 'udta']),
  mdia: new Set(['minf']),
  minf: new Set(['stbl']),
  moof: new Set(['traf']),
};

/**
 * Nhu forEachBox nhung CHAT CHE: moi bat thuong (rac cuoi hop cha, hop tran
 * ra ngoai cha, size nho hon header) deu nem TuChoiChenMehd thay vi dung im.
 */
function duyetChatChe(
  view: DataView,
  start: number,
  end: number,
  cha: string,
  visit: (type: string, hop: ViTriHop) => void
): void {
  let offset = start;
  while (offset < end) {
    if (offset + 8 > end) tuChoi(`con ${end - offset} byte rac cuoi hop ${cha || 'tep'}`);
    const size32 = readUintBE(view, offset, 4);
    const type = boxType(view, offset + 4);
    let size = size32;
    let headerSize = 8;
    if (size32 === 1) {
      if (offset + 16 > end) tuChoi(`hop ${type} khai bao largesize nhung khong du byte`);
      size = readUintBE(view, offset + 8, 8);
      headerSize = 16;
    } else if (size32 === 0) {
      size = end - offset; // hop chay den het cha
    }
    if (size < headerSize || offset + size > end) tuChoi(`hop ${type} trong ${cha || 'tep'} co kich thuoc bat thuong`);
    visit(type, { offset, headerSize, size });
    offset += size;
  }
}

interface CayMp4 {
  moov: ViTriHop;
  mvex: ViTriHop | null;
  mehd: ViTriHop | null;
  movieTimescale: number;
  offsets: TruongOffset[];
}

/**
 * Duyet toan bo cay hop, ghi nhan moov/mvex/mehd va MOI truong offset tuyet
 * doi. Nem TuChoiChenMehd neu gap bat ky thu gi ngoai danh sach trang.
 */
function phanTichCayMp4(view: DataView, total: number): CayMp4 | null {
  let moov: ViTriHop | null = null;
  let mvex: ViTriHop | null = null;
  let mehd: ViTriHop | null = null;
  let movieTimescale = 0;
  const offsets: TruongOffset[] = [];

  function ghiOffset(pos: number, width: number): void {
    const value = readUintBE(view, pos, width);
    if (value > total) tuChoi(`offset ${value} tro ra ngoai tep (${total} byte)`);
    offsets.push({ pos, width, value });
  }

  function docStco(type: string, hop: ViTriHop): void {
    const body = hop.offset + hop.headerSize;
    const end = hop.offset + hop.size;
    if (body + 8 > end) tuChoi(`${type} ngan hon header cua no`);
    const width = type === 'co64' ? 8 : 4;
    const entryCount = readUintBE(view, body + 4, 4);
    if (body + 8 + entryCount * width > end) tuChoi(`${type} khai ${entryCount} entry nhung khong du byte`);
    for (let i = 0; i < entryCount; i++) ghiOffset(body + 8 + i * width, width);
  }

  function docTfhd(hop: ViTriHop): void {
    const body = hop.offset + hop.headerSize;
    const end = hop.offset + hop.size;
    if (body + 8 > end) tuChoi('tfhd ngan hon header cua no');
    const { flags } = fullBoxVersionFlags(view, body);
    if (flags & 0x000001) {
      if (body + 16 > end) tuChoi('tfhd co base-data-offset-present nhung khong du byte');
      ghiOffset(body + 8, 8); // version+flags(4) + track_ID(4) -> base_data_offset(8)
    }
  }

  function docTfra(hop: ViTriHop): void {
    const body = hop.offset + hop.headerSize;
    const end = hop.offset + hop.size;
    if (body + 16 > end) tuChoi('tfra ngan hon header cua no');
    const { version } = fullBoxVersionFlags(view, body);
    if (version > 1) tuChoi(`tfra version ${version} khong biet`);
    const width = version === 1 ? 8 : 4;
    const lengths = readUintBE(view, body + 8, 4);
    const trafLen = ((lengths >>> 4) & 3) + 1;
    const trunLen = ((lengths >>> 2) & 3) + 1;
    const sampleLen = (lengths & 3) + 1;
    const entryCount = readUintBE(view, body + 12, 4);
    const entrySize = width * 2 + trafLen + trunLen + sampleLen;
    if (body + 16 + entryCount * entrySize > end) tuChoi(`tfra khai ${entryCount} entry nhung khong du byte`);
    for (let i = 0; i < entryCount; i++) {
      const pos = body + 16 + i * entrySize + width; // bo qua `time`, toi `moof_offset`
      const value = readUintBE(view, pos, width);
      if (value + 8 > total || boxType(view, value + 4) !== 'moof') tuChoi(`tfra.moof_offset=${value} khong tro vao hop moof`);
      ghiOffset(pos, width);
    }
  }

  function duyet(hop: ViTriHop, cha: string): void {
    duyetChatChe(view, hop.offset + hop.headerSize, hop.offset + hop.size, cha, (type, con) => {
      if (cha === 'udta') {
        if (type === 'meta') tuChoi('udta > meta co the chua iloc (offset tuyet doi)');
        return; // du lieu nguoi dung, khong chua offset tep
      }
      if (cha === 'moov' && type === 'mvhd') {
        const body = con.offset + con.headerSize;
        const tSize = timeFieldSize(view, body);
        movieTimescale = readUintBE(view, body + 4 + tSize * 2, 4);
        return;
      }
      if (cha === 'moov' && type === 'mvex') {
        if (mvex) tuChoi('nhieu hon mot mvex trong moov');
        mvex = con;
        duyet(con, 'mvex');
        return;
      }
      if (cha === 'mvex' && type === 'mehd') {
        if (mehd) tuChoi('nhieu hon mot mehd trong mvex');
        mehd = con;
        return;
      }
      if (cha === 'stbl' && (type === 'stco' || type === 'co64')) return docStco(type, con);
      if (cha === 'traf' && type === 'tfhd') return docTfhd(con);
      if (cha === 'mfra' && type === 'tfra') return docTfra(con);
      if (HOP_LA[cha]?.has(type)) return;
      if (HOP_DUYET[cha]?.has(type)) return duyet(con, type);
      tuChoi(`hop la '${type}' trong ${cha || 'cap tep'}`);
    });
  }

  duyetChatChe(view, 0, total, '', (type, hop) => {
    if (type === 'moov') {
      if (moov) tuChoi('nhieu hon mot moov');
      moov = hop;
      duyet(hop, 'moov');
    } else if (HOP_DUYET['']!.has(type)) {
      duyet(hop, type);
    } else if (!HOP_LA['']!.has(type)) {
      tuChoi(`hop la '${type}' o cap tep`);
    }
  });

  if (!moov) return null;
  return { moov, mvex, mehd, movieTimescale, offsets };
}

/** Thoi luong movie-level (giay) = track that dai nhat; roi ve `fallback` neu khong tinh duoc track nao. */
function thoiLuongPhimGiay(
  trackTimescales: Map<number, number>,
  trackSampleUnitSums: Map<number, number>,
  fallback: number
): number {
  let max = 0;
  for (const [trackId, units] of trackSampleUnitSums) {
    const timescale = trackTimescales.get(trackId);
    if (timescale !== undefined && timescale > 0) max = Math.max(max, units / timescale);
  }
  return max > 0 ? max : fallback;
}

/** Ghi lai size cua mot hop (32-bit hoac largesize 64-bit) sau khi than no dai them `delta` byte. */
function congSizeHop(view: DataView, hop: ViTriHop, delta: number): void {
  if (hop.headerSize === 16) {
    writeUintBE(view, hop.offset + 8, 8, hop.size + delta);
  } else {
    writeUintBE(view, hop.offset, 4, hop.size + delta);
  }
}

/** Xem themMehd. `movieSeconds` la thoi luong movie-level (giay) can ghi vao mehd. */
export function themMehd(buf: ArrayBuffer, movieSeconds: number): KetQuaMehd {
  const view = new DataView(buf);
  const total = buf.byteLength;

  let cay: CayMp4 | null;
  try {
    cay = phanTichCayMp4(view, total);
  } catch (e) {
    if (e instanceof TuChoiChenMehd) return { kieu: 'tu-choi', lyDo: e.message };
    throw e;
  }
  if (!cay || !cay.mvex) return { kieu: 'khong-can' };
  const { moov, mvex, mehd, movieTimescale, offsets } = cay;

  if (movieTimescale <= 0) return { kieu: 'tu-choi', lyDo: 'mvhd khong co timescale hop le' };
  if (!Number.isFinite(movieSeconds) || movieSeconds <= 0) return { kieu: 'tu-choi', lyDo: 'thoi luong phim khong hop le' };
  const fragmentDuration = Math.round(movieSeconds * movieTimescale);

  // Nhanh de: da co mehd -> chi ghi de gia tri, khong doi kich thuoc.
  if (mehd) {
    const body = mehd.offset + mehd.headerSize;
    const tSize = timeFieldSize(view, body);
    if (body + 4 + tSize > mehd.offset + mehd.size) return { kieu: 'tu-choi', lyDo: 'mehd ngan hon khai bao' };
    if (tSize === 4 && fragmentDuration > 0xffffffff) return { kieu: 'tu-choi', lyDo: 'mehd version 0 khong chua noi gia tri' };
    writeUintBE(view, body + 4, tSize, fragmentDuration);
    return { kieu: 'ghi-de' };
  }

  // Nhanh chen: dung mehd version 0 (16 byte) khi vua 32-bit, version 1 (20 byte) khi khong.
  const version = fragmentDuration > 0xffffffff ? 1 : 0;
  const tSize = version === 1 ? 8 : 4;
  const hopMehd = new Uint8Array(8 + 4 + tSize);
  const mehdView = new DataView(hopMehd.buffer);
  writeUintBE(mehdView, 0, 4, hopMehd.length);
  hopMehd.set([0x6d, 0x65, 0x68, 0x64], 4); // 'mehd'
  mehdView.setUint8(8, version); // flags = 0
  writeUintBE(mehdView, 12, tSize, fragmentDuration);
  const delta = hopMehd.length;

  // moov/mvex dung size32 = 0 ("den het cha") thi khong biet ghi lai size the nao -> tu choi.
  if (readUintBE(view, moov.offset, 4) === 0 || readUintBE(view, mvex.offset, 4) === 0) {
    return { kieu: 'tu-choi', lyDo: 'moov/mvex dung size=0' };
  }
  if (moov.headerSize === 8 && moov.size + delta > 0xffffffff) return { kieu: 'tu-choi', lyDo: 'moov qua lon cho size32' };

  // Chen mehd ngay sau header cua mvex (truoc trex — thu tu quy uoc).
  const insertPos = mvex.offset + mvex.headerSize;
  const src = new Uint8Array(buf);
  const out = new Uint8Array(total + delta);
  out.set(src.subarray(0, insertPos), 0);
  out.set(hopMehd, insertPos);
  out.set(src.subarray(insertPos), insertPos + delta);
  const outView = new DataView(out.buffer);

  // moov va mvex deu nam TRUOC cho chen nen vi tri header khong doi.
  congSizeHop(outView, moov, delta);
  congSizeHop(outView, mvex, delta);

  // Moi offset tuyet doi: ca VI TRI cua truong lan GIA TRI no tro toi deu
  // dich neu nam sau cho chen.
  for (const o of offsets) {
    const pos = o.pos >= insertPos ? o.pos + delta : o.pos;
    const value = o.value >= insertPos ? o.value + delta : o.value;
    writeUintBE(outView, pos, o.width, value);
  }

  return { kieu: 'chen', buf: out.buffer };
}

/**
 * Toan bo luong mp4: vá tai cho (mvhd/tkhd/mdhd) roi chen/ghi de mehd. Tra ve
 * buffer ket qua (co the la `buf` da sua tai cho, hoac buffer MOI dai hon khi
 * chen mehd) hoac null neu khong sua gi. Khi tu choi chen mehd -> canh bao va
 * giu ket qua vá tai cho.
 */
function xuLyMp4(buf: ArrayBuffer, seconds: number): ArrayBuffer | null {
  const changed = patchMp4Duration(buf, seconds);

  const view = new DataView(buf);
  const trackTimescales = collectTrackTimescales(view, buf.byteLength);
  const trackSampleUnitSums = collectTrackSampleSums(view, buf.byteLength);
  const movieSeconds = thoiLuongPhimGiay(trackTimescales, trackSampleUnitSums, seconds);

  const mehd = themMehd(buf, movieSeconds);
  if (mehd.kieu === 'chen') return mehd.buf;
  if (mehd.kieu === 'tu-choi') {
    console.warn(`[videoDuration] khong chen mehd, giu nguyen tep da va tai cho: ${mehd.lyDo}`);
  }
  return changed || mehd.kieu === 'ghi-de' ? buf : null;
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
 * chinh app minh dem duoc luc ghi). Tra ve Blob moi neu vá duoc (voi mp4 phan
 * manh: co the dai hon Blob goc dung 16 byte cua hop mehd), hoac nguyen Blob
 * dau vao neu khong nhan dien duoc container hay khong tim thay cho de vá.
 */
export async function fixVideoDuration(blob: Blob, durationSeconds: number): Promise<Blob> {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return blob;

  const isMp4 = blob.type.includes('mp4');
  const isWebm = blob.type.includes('webm');
  if (!isMp4 && !isWebm) return blob;

  const buf = await blob.arrayBuffer();
  if (isMp4) {
    const out = xuLyMp4(buf, durationSeconds);
    return out ? new Blob([out], { type: blob.type }) : blob;
  }
  return patchWebmDuration(buf, durationSeconds) ? new Blob([buf], { type: blob.type }) : blob;
}
