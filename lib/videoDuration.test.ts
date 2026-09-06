/**
 * Test hoi quy cho issue #32 — "Save video vao Photos bi cat con hon 1 phut".
 *
 * MediaRecorder ghi container (mp4/webm) voi truong duration SAI (loi cua
 * trinh duyet, khong phai loi ghep chunk). fixVideoDuration phai va lai gia
 * tri that ma khong dung toi phan con lai cua tep.
 *
 * Dung buffer mp4/webm TU DUNG (toi thieu) thay vi tep that: du de kiem tra
 * dung box/phan tu can va, khong keo theo du lieu hinh/am nao.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixVideoDuration } from './videoDuration.ts';

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function ascii(s: string): number[] {
  return Array.from(s, (c) => c.charCodeAt(0));
}

/** box mp4 (size32 + type(4) + body), size tu tinh tu do dai body. */
function box(type: string, body: number[]): number[] {
  const size = 8 + body.length;
  return [...u32be(size), ...ascii(type), ...body];
}

/** mvhd/tkhd/mdhd version 0: version+flags(4) + creation(4) + modification(4) + [phan rieng]. */
function fullBoxHeaderV0(): number[] {
  return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // version+flags, creation, modification
}

function mvhdBox(timescale: number, duration: number): number[] {
  const body = [
    ...fullBoxHeaderV0(),
    ...u32be(timescale),
    ...u32be(duration),
    ...new Array(80).fill(0), // rate, volume, reserved, matrix, ... (khong quan trong voi test)
  ];
  return box('mvhd', body);
}

function tkhdBox(duration: number): number[] {
  const body = [
    ...fullBoxHeaderV0(),
    ...u32be(1), // track_ID
    ...u32be(0), // reserved
    ...u32be(duration),
    ...new Array(60).fill(0),
  ];
  return box('tkhd', body);
}

function mdhdBox(timescale: number, duration: number): number[] {
  const body = [
    ...fullBoxHeaderV0(),
    ...u32be(timescale),
    ...u32be(duration),
    ...new Array(4).fill(0), // language + pre_defined
  ];
  return box('mdhd', body);
}

function tepMp4(timescale: number, saiDuration: number): Uint8Array {
  const mdhd = mdhdBox(timescale, saiDuration);
  const mdia = box('mdia', mdhd);
  const tkhd = tkhdBox(saiDuration);
  const trak = box('trak', [...tkhd, ...mdia]);
  const mvhd = mvhdBox(timescale, saiDuration);
  const moov = box('moov', [...mvhd, ...trak]);
  const ftyp = box('ftyp', ascii('isommp42'));
  return new Uint8Array([...ftyp, ...moov]);
}

function docU32(buf: Uint8Array, offset: number): number {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(offset);
}

/** Tim box con truc tiep theo type, tra ve offset bat dau BODY cua no. */
function timBox(buf: Uint8Array, start: number, end: number, type: string): number {
  let offset = start;
  while (offset < end) {
    const size = docU32(buf, offset);
    const t = String.fromCharCode(buf[offset + 4], buf[offset + 5], buf[offset + 6], buf[offset + 7]);
    if (t === type) return offset + 8;
    offset += size;
  }
  throw new Error(`khong thay box ${type}`);
}

test('mp4: va lai duration sai trong mvhd/tkhd/mdhd bang thoi luong that', async () => {
  const timescale = 1000;
  const saiDuration = 5_000; // container tuong dai 5 giay
  const thatGiay = 182; // con quay that 3 phut 2 giay

  const goc = tepMp4(timescale, saiDuration);
  const blob = new Blob([goc as BlobPart], { type: 'video/mp4;codecs=avc1' });

  const daVa = await fixVideoDuration(blob, thatGiay);
  assert.notEqual(daVa, blob, 'phai tra ve Blob moi khi va thanh cong');

  const buf = new Uint8Array(await daVa.arrayBuffer());
  assert.equal(buf.length, goc.length, 'khong duoc doi kich thuoc tep');

  const moovBody = timBox(buf, 0, buf.length, 'moov');
  const moovSize = docU32(buf, moovBody - 8);
  const mvhdBody = timBox(buf, moovBody, moovBody + moovSize - 8, 'mvhd');
  const trakBody = timBox(buf, moovBody, moovBody + moovSize - 8, 'trak');
  const trakSize = docU32(buf, trakBody - 8);
  const tkhdBody = timBox(buf, trakBody, trakBody + trakSize - 8, 'tkhd');
  const mdiaBody = timBox(buf, trakBody, trakBody + trakSize - 8, 'mdia');
  const mdiaSize = docU32(buf, mdiaBody - 8);
  const mdhdBody = timBox(buf, mdiaBody, mdiaBody + mdiaSize - 8, 'mdhd');

  const kyVongDonVi = thatGiay * timescale;
  // mvhd/tkhd: version+flags(4) + creation(4) + modification(4) + [timescale(4) chi mvhd] + duration(4)
  assert.equal(docU32(buf, mvhdBody + 12 + 4), kyVongDonVi, 'mvhd.duration phai la thoi luong that');
  assert.equal(docU32(buf, tkhdBody + 12 + 4 + 4), kyVongDonVi, 'tkhd.duration phai la thoi luong that');
  assert.equal(docU32(buf, mdhdBody + 12 + 4), kyVongDonVi, 'mdhd.duration phai la thoi luong that');
});

// ------------------------------------------------- Hoi quy: track-aware (Safari 2x)

function tkhdBoxTrackId(trackId: number, duration: number): number[] {
  const body = [
    ...fullBoxHeaderV0(),
    ...u32be(trackId),
    ...u32be(0), // reserved
    ...u32be(duration),
    ...new Array(60).fill(0),
  ];
  return box('tkhd', body);
}

function versionFlagsBytes(version: number, flags: number): number[] {
  return [version & 0xff, (flags >>> 16) & 0xff, (flags >>> 8) & 0xff, flags & 0xff];
}

/** tfhd toi gian: chi version+flags(0) + track_ID, khong dung base-data-offset/default-sample-duration. */
function tfhdBox(trackId: number): number[] {
  const body = [...versionFlagsBytes(0, 0), ...u32be(trackId)];
  return box('tfhd', body);
}

/** trun voi cac sample_duration THAT — chi bat co sample-duration-present (0x100). */
function trunBox(sampleDurations: number[]): number[] {
  const SAMPLE_DURATION_PRESENT = 0x000100;
  const body = [
    ...versionFlagsBytes(0, SAMPLE_DURATION_PRESENT),
    ...u32be(sampleDurations.length),
    ...sampleDurations.flatMap((d) => u32be(d)),
  ];
  return box('trun', body);
}

function timTatCaBox(buf: Uint8Array, start: number, end: number, type: string): { body: number; size: number }[] {
  const ketQua: { body: number; size: number }[] = [];
  let offset = start;
  while (offset < end) {
    const size = docU32(buf, offset);
    const t = String.fromCharCode(buf[offset + 4], buf[offset + 5], buf[offset + 6], buf[offset + 7]);
    if (t === type) ketQua.push({ body: offset + 8, size });
    offset += size;
  }
  return ketQua;
}

test('mp4: moi track (audio/video) duoc va bang thoi luong mau THAT rieng cua no, khong con bi ep ve cung mot so', async () => {
  const movieTimescale = 1000;
  const saiDuration = 999_000; // placeholder sai chung, giong loi goc truoc khi va

  const AUDIO_ID = 1;
  const VIDEO_ID = 2;
  const audioMdhdTimescale = 48000;
  const videoMdhdTimescale = 600;
  // Du lieu mau THAT cua tung track — co tinh khac han nhau, dung tinh huong
  // that trong bao cao btvn-video-mau-that (audio ~24s, video ~326s).
  const audioSampleUnits = 24 * audioMdhdTimescale; // 24.0000s
  const videoSampleUnits = 326 * videoMdhdTimescale; // 326.0000s

  const mvhd = mvhdBox(movieTimescale, saiDuration);
  const audioTrak = box('trak', [
    ...tkhdBoxTrackId(AUDIO_ID, saiDuration),
    ...box('mdia', mdhdBox(audioMdhdTimescale, saiDuration)),
  ]);
  const videoTrak = box('trak', [
    ...tkhdBoxTrackId(VIDEO_ID, saiDuration),
    ...box('mdia', mdhdBox(videoMdhdTimescale, saiDuration)),
  ]);
  const moov = box('moov', [...mvhd, ...audioTrak, ...videoTrak]);
  const ftyp = box('ftyp', ascii('isomiso2avc1mp41'));

  const moof = box('moof', [
    ...box('traf', [...tfhdBox(AUDIO_ID), ...trunBox([audioSampleUnits])]),
    ...box('traf', [...tfhdBox(VIDEO_ID), ...trunBox([videoSampleUnits])]),
  ]);

  const goc = new Uint8Array([...ftyp, ...moov, ...moof]);
  const blob = new Blob([goc as BlobPart], { type: 'video/mp4;codecs=avc1' });

  const elapsedGiay = 325; // dong ho dem tong the cua QuayVideo (elapsedRef) — khac ca 2 track that
  const daVa = await fixVideoDuration(blob, elapsedGiay);
  assert.notEqual(daVa, blob, 'phai tra ve Blob moi khi va thanh cong');

  const buf = new Uint8Array(await daVa.arrayBuffer());
  assert.equal(buf.length, goc.length, 'khong duoc doi kich thuoc tep');

  const moovBody = timBox(buf, 0, buf.length, 'moov');
  const moovSize = docU32(buf, moovBody - 8);
  const mvhdBody = timBox(buf, moovBody, moovBody + moovSize - 8, 'mvhd');

  // mvhd van dung `seconds` chung nhu cu — khong doi hanh vi hien co.
  assert.equal(docU32(buf, mvhdBody + 12 + 4), elapsedGiay * movieTimescale, 'mvhd (tong the) phai giu nguyen elapsedRef');

  const traks = timTatCaBox(buf, moovBody, moovBody + moovSize - 8, 'trak');
  assert.equal(traks.length, 2, 'phai tim thay 2 trak');

  const theoTrackId = new Map<number, { tkhdDuration: number; mdhdDuration: number }>();
  for (const trak of traks) {
    const trakEnd = trak.body + trak.size - 8;
    const tkhdBody = timBox(buf, trak.body, trakEnd, 'tkhd');
    const trackId = docU32(buf, tkhdBody + 12);
    const tkhdDuration = docU32(buf, tkhdBody + 12 + 4 + 4);
    const mdiaBody = timBox(buf, trak.body, trakEnd, 'mdia');
    const mdiaSize = docU32(buf, mdiaBody - 8);
    const mdhdBody = timBox(buf, mdiaBody, mdiaBody + mdiaSize - 8, 'mdhd');
    const mdhdDuration = docU32(buf, mdhdBody + 12 + 4);
    theoTrackId.set(trackId, { tkhdDuration, mdhdDuration });
  }

  const audio = theoTrackId.get(AUDIO_ID)!;
  const video = theoTrackId.get(VIDEO_ID)!;

  // mdhd: cung timescale voi chinh track do -> ghi THANG tong don vi mau that, chinh xac tuyet doi.
  assert.equal(audio.mdhdDuration, audioSampleUnits, 'mdhd audio phai la thoi luong mau THAT cua chinh no');
  assert.equal(video.mdhdDuration, videoSampleUnits, 'mdhd video phai la thoi luong mau THAT cua chinh no');

  // tkhd: theo timescale cua PHIM (mvhd) -> quy doi tu giay that cua tung track.
  assert.equal(audio.tkhdDuration, Math.round(24 * movieTimescale), 'tkhd audio phai khop 24s that cua no');
  assert.equal(video.tkhdDuration, Math.round(326 * movieTimescale), 'tkhd video phai khop 326s that cua no');

  // Diem mau chot cua bug goc: hai track KHONG con bi ep ve cung mot gia tri.
  assert.notEqual(audio.tkhdDuration, video.tkhdDuration, 'tkhd 2 track phai khac nhau (khong con bi ep chung)');
  assert.notEqual(audio.mdhdDuration, video.mdhdDuration, 'mdhd 2 track phai khac nhau (khong con bi ep chung)');
});

test('mp4: khong doi Blob goc khi khong nhan dien duoc box can va', async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'video/mp4' });
  const ketQua = await fixVideoDuration(blob, 60);
  assert.equal(ketQua, blob, 'du lieu hong/khong du box thi tra nguyen Blob dau vao');
});

// --------------------------------------------------------------------- WebM

function ebmlSize1(n: number): number[] {
  // 1-byte vint size: bit danh dau 0x80 + gia tri (toi da 0x7e = 126)
  return [0x80 | n];
}

function ebmlDurationFloat64(saiGiayScaledUnits: number): number[] {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, saiGiayScaledUnits);
  // ID Duration = 0x4489, size = 8 (1-byte vint)
  return [0x44, 0x89, ...ebmlSize1(8), ...Array.from(new Uint8Array(buf))];
}

function ebmlTimecodeScale(scale: number): number[] {
  // ID TimecodeScale = 0x2AD7B1 (3 byte), gia tri u32be, size = 4
  return [0x2a, 0xd7, 0xb1, ...ebmlSize1(4), ...u32be(scale)];
}

function tepWebm(scale: number, saiDonVi: number): Uint8Array {
  const duration = ebmlDurationFloat64(saiDonVi);
  const timecodeScale = ebmlTimecodeScale(scale);
  const infoBody = [...timecodeScale, ...duration];
  // ID Info = 0x1549A966 (4 byte)
  const info = [0x15, 0x49, 0xa9, 0x66, ...ebmlSize1(infoBody.length), ...infoBody];
  // ID Segment = 0x18538067 (4 byte)
  const segment = [0x18, 0x53, 0x80, 0x67, ...ebmlSize1(info.length), ...info];
  return new Uint8Array(segment);
}

test('webm: va lai Duration co san trong Segment>Info bang thoi luong that', async () => {
  const scale = 1_000_000; // 1 don vi = 1ms (mac dinh Matroska)
  const goc = tepWebm(scale, 4_000); // container tuong dai 4 giay
  const blob = new Blob([goc as BlobPart], { type: 'video/webm;codecs=vp9' });

  const thatGiay = 63;
  const daVa = await fixVideoDuration(blob, thatGiay);
  assert.notEqual(daVa, blob);

  const buf = new Uint8Array(await daVa.arrayBuffer());
  assert.equal(buf.length, goc.length, 'khong duoc doi kich thuoc tep');

  // Duration nam o 8 byte cuoi buffer (theo cach dung tren)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const donViDoc = view.getFloat64(buf.length - 8);
  const kyVongDonVi = (thatGiay * 1e9) / scale;
  assert.ok(Math.abs(donViDoc - kyVongDonVi) < 1e-6, `mong ${kyVongDonVi}, duoc ${donViDoc}`);
});

test('webm: khong co san Duration thi bo qua, tra nguyen Blob goc', async () => {
  // Segment > Info rong, khong co Duration
  const info: number[] = [];
  const segmentBody = [0x15, 0x49, 0xa9, 0x66, ...ebmlSize1(info.length), ...info];
  const goc = new Uint8Array([0x18, 0x53, 0x80, 0x67, ...ebmlSize1(segmentBody.length), ...segmentBody]);
  const blob = new Blob([goc], { type: 'video/webm' });

  const ketQua = await fixVideoDuration(blob, 60);
  assert.equal(ketQua, blob);
});

test('khong phai mp4/webm thi bo qua', async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/quicktime' });
  const ketQua = await fixVideoDuration(blob, 60);
  assert.equal(ketQua, blob);
});

test('thoi luong khong hop le (0, am, NaN) thi bo qua', async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' });
  assert.equal(await fixVideoDuration(blob, 0), blob);
  assert.equal(await fixVideoDuration(blob, -5), blob);
  assert.equal(await fixVideoDuration(blob, NaN), blob);
});

// --------------------------------------- Hoi quy: chen mvex > mehd (Safari 2x, buoc 2)
//
// Nguon: data/btvn-video-mau-that-2/report.md. File MediaRecorder cua Safari co
// mvex nhung KHONG co mehd; vá gia tri tung track (test o tren) khong du, phai
// CHEN them hop mehd — doi kich thuoc tep, dich moi offset tuyet doi phia sau.
// Cac test duoi day dung mot tep mp4 phan manh gia co du: moov(mvhd + 2 trak co
// stco/co64 tro vao mdat) + mvex(trex x2) + moof(tfhd co base_data_offset hoac
// default-base-is-moof + trun) + mdat (payload nhan dang duoc) + mfra(tfra tro
// vao moof). Sau khi chen, duyet lai cay va kiem tra tung offset VAN TRO DUNG
// byte nhu truoc — khong chi so sanh so.

import { themMehd } from './videoDuration.ts';

function u64be(n: number): number[] {
  const hi = Math.floor(n / 2 ** 32);
  const lo = n % 2 ** 32;
  return [...u32be(hi), ...u32be(lo)];
}

function fullBox(type: string, version: number, flags: number, body: number[]): number[] {
  return box(type, [...versionFlagsBytes(version, flags), ...body]);
}

function stcoBox(entries: number[], co64: boolean): number[] {
  return fullBox(co64 ? 'co64' : 'stco', 0, 0, [
    ...u32be(entries.length),
    ...entries.flatMap((e) => (co64 ? u64be(e) : u32be(e))),
  ]);
}

function trexBox(trackId: number): number[] {
  return fullBox('trex', 0, 0, [...u32be(trackId), ...u32be(1), ...u32be(0), ...u32be(0), ...u32be(0)]);
}

function mehdBoxV0(fragmentDuration: number): number[] {
  return fullBox('mehd', 0, 0, u32be(fragmentDuration));
}

const TFHD_BASE_DATA_OFFSET_PRESENT = 0x000001;
const TFHD_DEFAULT_BASE_IS_MOOF = 0x020000;

function tfhdBaseOffset(trackId: number, baseDataOffset: number): number[] {
  return fullBox('tfhd', 0, TFHD_BASE_DATA_OFFSET_PRESENT, [...u32be(trackId), ...u64be(baseDataOffset)]);
}

function tfhdDefaultBaseIsMoof(trackId: number): number[] {
  return fullBox('tfhd', 0, TFHD_DEFAULT_BASE_IS_MOOF, u32be(trackId));
}

/** trun co data_offset (0x1) + sample_duration (0x100) + sample_size (0x200). */
function trunDataOffset(dataOffset: number, samples: { duration: number; size: number }[]): number[] {
  return fullBox('trun', 0, 0x000001 | 0x000100 | 0x000200, [
    ...u32be(samples.length),
    ...u32be(dataOffset),
    ...samples.flatMap((s) => [...u32be(s.duration), ...u32be(s.size)]),
  ]);
}

function tfraBox(trackId: number, version: 0 | 1, entries: { time: number; moofOffset: number }[]): number[] {
  const w = version === 1 ? u64be : u32be;
  return fullBox('tfra', version, 0, [
    ...u32be(trackId),
    ...u32be(0), // length_size_of_traf_num/trun_num/sample_num = 0 -> moi so 1 byte
    ...u32be(entries.length),
    ...entries.flatMap((e) => [...w(e.time), ...w(e.moofOffset), 1, 1, 1]),
  ]);
}

function mfroBox(mfraSize: number): number[] {
  return fullBox('mfro', 0, 0, u32be(mfraSize));
}

const AUDIO_ID = 1;
const VIDEO_ID = 2;
const MOVIE_TIMESCALE = 1000;
const AUDIO_TIMESCALE = 48000;
const VIDEO_TIMESCALE = 600;
const CHUNK_AUDIO = ascii('AUDIO-CHUNK-01!!'); // 16 byte
const CHUNK_VIDEO = ascii('VIDEO-CHUNK-01!!'); // 16 byte

interface TuyChonTep {
  co64?: boolean;
  tfhd?: 'base-data-offset' | 'default-base-is-moof';
  tfraVersion?: 0 | 1;
  /** Chen san mehd (sai) vao mvex de test nhanh ghi de. */
  mehdSan?: number;
  /** Chen them hop la vao cap tep / stbl / moov de test nhanh tu choi. */
  hopLa?: 'sidx-cap-tep' | 'saio-trong-stbl' | 'meta-trong-moov' | 'tfra-tro-sai';
  /** Bo mfra (giong file Safari that). */
  khongMfra?: boolean;
}

/** Thoi luong mau THAT cua tung track — 2 track gan bang nhau nhu video binh thuong (bao cao mau "bena"). */
const AUDIO_UNITS = Math.round(20.6933 * AUDIO_TIMESCALE); // 993278
const VIDEO_UNITS = Math.round(20.65 * VIDEO_TIMESCALE); // 12390

/**
 * Dung tep 2 luot: luot 1 voi offset = 0 de do bo cuc, luot 2 dien offset that
 * (moi truong offset co do rong co dinh nen bo cuc khong doi).
 */
function dungTepPhanManh(opt: TuyChonTep = {}): Uint8Array {
  const co64 = opt.co64 ?? false;
  const kieuTfhd = opt.tfhd ?? 'base-data-offset';
  const saiDuration = 777_000;

  function dung(offs: { mdatBody: number; moof: number; audioChunk: number; videoChunk: number }): Uint8Array {
    const stblAudio = box('stbl', [...box('stsd', u32be(0)), ...stcoBox([offs.audioChunk], co64)]);
    const stblVideo = box('stbl', [
      ...box('stsd', u32be(0)),
      ...(opt.hopLa === 'saio-trong-stbl' ? fullBox('saio', 0, 0, [...u32be(1), ...u32be(offs.videoChunk)]) : []),
      ...stcoBox([offs.videoChunk, offs.videoChunk + 8], co64),
    ]);
    const audioTrak = box('trak', [
      ...tkhdBoxTrackId(AUDIO_ID, saiDuration),
      ...box('mdia', [...mdhdBox(AUDIO_TIMESCALE, saiDuration), ...box('minf', [...box('smhd', u32be(0)), ...stblAudio])]),
    ]);
    const videoTrak = box('trak', [
      ...tkhdBoxTrackId(VIDEO_ID, saiDuration),
      ...box('mdia', [...mdhdBox(VIDEO_TIMESCALE, saiDuration), ...box('minf', [...box('vmhd', u32be(0)), ...stblVideo])]),
    ]);
    const mvex = box('mvex', [
      ...(opt.mehdSan !== undefined ? mehdBoxV0(opt.mehdSan) : []),
      ...trexBox(AUDIO_ID),
      ...trexBox(VIDEO_ID),
    ]);
    const moov = box('moov', [
      ...mvhdBox(MOVIE_TIMESCALE, saiDuration),
      ...audioTrak,
      ...videoTrak,
      ...(opt.hopLa === 'meta-trong-moov' ? fullBox('meta', 0, 0, []) : []),
      ...mvex,
    ]);
    const ftyp = box('ftyp', ascii('iso5mp42'));
    const sidx = opt.hopLa === 'sidx-cap-tep' ? fullBox('sidx', 0, 0, new Array(20).fill(0)) : [];

    // mdat payload: [AUDIO chunk 16 byte][VIDEO chunk 16 byte]
    const mdat = box('mdat', [...CHUNK_AUDIO, ...CHUNK_VIDEO]);
    const audioRel = 0;
    const videoRel = CHUNK_AUDIO.length;

    let trafAudio: number[];
    let trafVideo: number[];
    if (kieuTfhd === 'base-data-offset') {
      // base_data_offset TUYET DOI tro thang vao dau chunk; trun.data_offset = 0.
      trafAudio = box('traf', [
        ...tfhdBaseOffset(AUDIO_ID, offs.mdatBody + audioRel),
        ...trunDataOffset(0, [{ duration: AUDIO_UNITS, size: CHUNK_AUDIO.length }]),
      ]);
      trafVideo = box('traf', [
        ...tfhdBaseOffset(VIDEO_ID, offs.mdatBody + videoRel),
        ...trunDataOffset(0, [{ duration: VIDEO_UNITS, size: CHUNK_VIDEO.length }]),
      ]);
    } else {
      // default-base-is-moof (Safari that: flags 0x2001a/0x20038): data_offset TUONG DOI so voi dau moof.
      trafAudio = box('traf', [
        ...tfhdDefaultBaseIsMoof(AUDIO_ID),
        ...trunDataOffset(offs.mdatBody + audioRel - offs.moof, [{ duration: AUDIO_UNITS, size: CHUNK_AUDIO.length }]),
      ]);
      trafVideo = box('traf', [
        ...tfhdDefaultBaseIsMoof(VIDEO_ID),
        ...trunDataOffset(offs.mdatBody + videoRel - offs.moof, [{ duration: VIDEO_UNITS, size: CHUNK_VIDEO.length }]),
      ]);
    }
    const moof = box('moof', [...fullBox('mfhd', 0, 0, u32be(1)), ...trafAudio, ...trafVideo]);

    const tfraTarget = opt.hopLa === 'tfra-tro-sai' ? offs.moof + 4 : offs.moof;
    const tfras = [
      ...tfraBox(AUDIO_ID, opt.tfraVersion ?? 1, [{ time: 0, moofOffset: tfraTarget }]),
      ...tfraBox(VIDEO_ID, opt.tfraVersion ?? 1, [{ time: 0, moofOffset: tfraTarget }]),
    ];
    const mfraSize = 8 + tfras.length + 16;
    const mfra = opt.khongMfra ? [] : box('mfra', [...tfras, ...mfroBox(mfraSize)]);

    return new Uint8Array([...ftyp, ...sidx, ...moov, ...moof, ...mdat, ...mfra]);
  }

  const nhap = dung({ mdatBody: 0, moof: 0, audioChunk: 0, videoChunk: 0 });
  const cayNhap = cayHop(nhap);
  const moofNhap = timHop(cayNhap, 'moof')!;
  const mdatNhap = timHop(cayNhap, 'mdat')!;
  const mdatBody = mdatNhap.offset + mdatNhap.headerSize;
  return dung({
    mdatBody,
    moof: moofNhap.offset,
    audioChunk: mdatBody,
    videoChunk: mdatBody + CHUNK_AUDIO.length,
  });
}

// ---- Bo duyet cay doc lap cho test (khong dung lai code cua module dang test)

interface Hop {
  type: string;
  offset: number;
  headerSize: number;
  size: number;
  children: Hop[];
}

const CHA_TRONG_TEST = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'mvex', 'moof', 'traf', 'mfra']);

/** Duyet CHAT CHE: moi hop phai nam gon trong cha, ket thuc dung tai `end` — sai thi nem loi. */
function duyetHop(buf: Uint8Array, start: number, end: number): Hop[] {
  const ra: Hop[] = [];
  let offset = start;
  while (offset < end) {
    assert.ok(offset + 8 <= end, `rac ${end - offset} byte tai ${offset}`);
    const size = docU32(buf, offset);
    const type = String.fromCharCode(buf[offset + 4], buf[offset + 5], buf[offset + 6], buf[offset + 7]);
    assert.ok(size >= 8 && offset + size <= end, `hop ${type} @${offset} size=${size} tran ra ngoai [${start},${end})`);
    const hop: Hop = { type, offset, headerSize: 8, size, children: [] };
    if (CHA_TRONG_TEST.has(type)) hop.children = duyetHop(buf, offset + 8, offset + size);
    ra.push(hop);
    offset += size;
  }
  assert.equal(offset, end, 'hop cuoi phai ket thuc dung tai end');
  return ra;
}

function cayHop(buf: Uint8Array): Hop[] {
  return duyetHop(buf, 0, buf.length);
}

/** Tim hop theo duong dan 'moov/mvex/mehd' (hop dau tien khop o moi cap). */
function timHop(cay: Hop[], duongDan: string): Hop | undefined {
  let muc = cay;
  let hop: Hop | undefined;
  for (const type of duongDan.split('/')) {
    hop = muc.find((h) => h.type === type);
    if (!hop) return undefined;
    muc = hop.children;
  }
  return hop;
}

function timTatCa(cay: Hop[], type: string): Hop[] {
  const ra: Hop[] = [];
  for (const h of cay) {
    if (h.type === type) ra.push(h);
    ra.push(...timTatCa(h.children, type));
  }
  return ra;
}

function docU64(buf: Uint8Array, offset: number): number {
  return docU32(buf, offset) * 2 ** 32 + docU32(buf, offset + 4);
}

function chuoiTai(buf: Uint8Array, offset: number, len: number): string {
  return String.fromCharCode(...buf.subarray(offset, offset + len));
}

/** Doc moi entry stco/co64: { pos (vi tri truong), value }. */
function docChunkOffsets(buf: Uint8Array, hop: Hop): { pos: number; value: number }[] {
  const body = hop.offset + hop.headerSize;
  const w = hop.type === 'co64' ? 8 : 4;
  const n = docU32(buf, body + 4);
  const ra: { pos: number; value: number }[] = [];
  for (let i = 0; i < n; i++) {
    const pos = body + 8 + i * w;
    ra.push({ pos, value: w === 8 ? docU64(buf, pos) : docU32(buf, pos) });
  }
  return ra;
}

/** Doc tfhd: { trackId, flags, baseDataOffset? } */
function docTfhd(buf: Uint8Array, hop: Hop): { trackId: number; flags: number; baseDataOffset?: number; baseDataOffsetPos?: number } {
  const body = hop.offset + hop.headerSize;
  const flags = docU32(buf, body) & 0xffffff;
  const trackId = docU32(buf, body + 4);
  if (flags & TFHD_BASE_DATA_OFFSET_PRESENT) return { trackId, flags, baseDataOffset: docU64(buf, body + 8), baseDataOffsetPos: body + 8 };
  return { trackId, flags };
}

/** Doc trun.data_offset (test luon bat flag 0x1). */
function docTrunDataOffset(buf: Uint8Array, hop: Hop): number {
  const body = hop.offset + hop.headerSize;
  const raw = docU32(buf, body + 8);
  return raw | 0; // signed int32
}

/** Doc moi entry tfra: { pos, moofOffset } */
function docTfra(buf: Uint8Array, hop: Hop): { version: number; entries: { pos: number; moofOffset: number }[] } {
  const body = hop.offset + hop.headerSize;
  const version = buf[body];
  const w = version === 1 ? 8 : 4;
  const lengths = docU32(buf, body + 8);
  const entrySize = w * 2 + (((lengths >>> 4) & 3) + 1) + (((lengths >>> 2) & 3) + 1) + ((lengths & 3) + 1);
  const n = docU32(buf, body + 12);
  const entries: { pos: number; moofOffset: number }[] = [];
  for (let i = 0; i < n; i++) {
    const pos = body + 16 + i * entrySize + w;
    entries.push({ pos, moofOffset: w === 8 ? docU64(buf, pos) : docU32(buf, pos) });
  }
  return { version, entries };
}

const MEHD_SIZE = 16;
const ELAPSED_GIAY = 20; // dong ho QuayVideo dem duoc (so nguyen), nho hon ca 2 track that
const KY_VONG_MEHD = Math.round(Math.max(AUDIO_UNITS / AUDIO_TIMESCALE, VIDEO_UNITS / VIDEO_TIMESCALE) * MOVIE_TIMESCALE);

/**
 * Kiem tra day du mot tep sau khi chen mehd so voi tep goc. Dung chung cho cac
 * bien the (stco/co64, base-data-offset/default-base-is-moof, tfra v0/v1).
 */
function kiemTraDaChen(goc: Uint8Array, ra: Uint8Array): void {
  assert.equal(ra.length, goc.length + MEHD_SIZE, 'tep phai dai them dung 16 byte cua mehd');

  const cayGoc = cayHop(goc);
  const cayRa = cayHop(ra); // duyet chat che: moi hop van nam gon, ket thuc dung EOF

  // Thu tu hop cap tep khong doi.
  assert.deepEqual(cayRa.map((h) => h.type), cayGoc.map((h) => h.type));

  // moov/mvex dai them dung 16 byte; cac hop cap tep khac giu nguyen size.
  const moovGoc = timHop(cayGoc, 'moov')!;
  const moovRa = timHop(cayRa, 'moov')!;
  assert.equal(moovRa.size, moovGoc.size + MEHD_SIZE, 'moov.size');
  const mvexGoc = timHop(cayGoc, 'moov/mvex')!;
  const mvexRa = timHop(cayRa, 'moov/mvex')!;
  assert.equal(mvexRa.size, mvexGoc.size + MEHD_SIZE, 'mvex.size');
  for (const type of ['ftyp', 'moof', 'mdat', 'mfra']) {
    const g = timHop(cayGoc, type);
    const r = timHop(cayRa, type);
    if (g) assert.equal(r!.size, g.size, `${type}.size khong duoc doi`);
  }

  // mehd: hop con DAU TIEN cua mvex, version 0, gia tri = track dai nhat theo movieTimescale.
  assert.equal(mvexGoc.children.some((h) => h.type === 'mehd'), false, 'tep goc khong co mehd');
  assert.equal(mvexRa.children[0].type, 'mehd', 'mehd phai dung dau mvex');
  assert.equal(mvexRa.children[0].size, MEHD_SIZE);
  const mehdBody = mvexRa.children[0].offset + 8;
  assert.equal(docU32(ra, mehdBody) >>> 24, 0, 'mehd version 0');
  assert.equal(docU32(ra, mehdBody + 4), KY_VONG_MEHD, 'mehd.fragment_duration = max(track that) * movieTimescale');
  assert.deepEqual(
    mvexRa.children.slice(1).map((h) => h.type),
    mvexGoc.children.map((h) => h.type),
    'cac trex sau mehd giu nguyen'
  );

  const insertPos = mvexGoc.offset + mvexGoc.headerSize;
  const dich = (x: number) => (x >= insertPos ? x + MEHD_SIZE : x);

  // Tang 1 (PR #37) van chay: mvhd = elapsed, tkhd/mdhd = thoi luong that tung track.
  const mvhdRa = timHop(cayRa, 'moov/mvhd')!;
  assert.equal(docU32(ra, mvhdRa.offset + 8 + 12 + 4), ELAPSED_GIAY * MOVIE_TIMESCALE, 'mvhd van la elapsedRef');
  for (const trak of timHop(cayRa, 'moov')!.children.filter((h) => h.type === 'trak')) {
    const tkhd = trak.children.find((h) => h.type === 'tkhd')!;
    const trackId = docU32(ra, tkhd.offset + 8 + 12);
    const mdhd = timHop(trak.children, 'mdia/mdhd')!;
    const units = trackId === AUDIO_ID ? AUDIO_UNITS : VIDEO_UNITS;
    const ts = trackId === AUDIO_ID ? AUDIO_TIMESCALE : VIDEO_TIMESCALE;
    assert.equal(docU32(ra, mdhd.offset + 8 + 12 + 4), units, `mdhd track ${trackId}`);
    assert.equal(docU32(ra, tkhd.offset + 8 + 12 + 8), Math.round((units / ts) * MOVIE_TIMESCALE), `tkhd track ${trackId}`);
  }

  // stco/co64: tung entry dich dung delta, VA byte tai do van la chunk cu.
  const stcoGoc = [...timTatCa(cayGoc, 'stco'), ...timTatCa(cayGoc, 'co64')];
  const stcoRa = [...timTatCa(cayRa, 'stco'), ...timTatCa(cayRa, 'co64')];
  assert.equal(stcoGoc.length, 2, 'test can 2 bang chunk offset');
  assert.equal(stcoRa.length, 2);
  let soEntry = 0;
  for (let i = 0; i < stcoGoc.length; i++) {
    const eg = docChunkOffsets(goc, stcoGoc[i]);
    const er = docChunkOffsets(ra, stcoRa[i]);
    assert.equal(er.length, eg.length);
    for (let j = 0; j < eg.length; j++) {
      soEntry++;
      assert.equal(er[j].pos, dich(eg[j].pos), 'vi tri truong stco (trong moov, truoc mvex) khong doi');
      assert.equal(er[j].value, eg[j].value + MEHD_SIZE, `entry ${j} cua bang ${i} phai cong 16`);
      const len = 8;
      assert.equal(chuoiTai(ra, er[j].value, len), chuoiTai(goc, eg[j].value, len), 'byte ma entry tro toi phai y nhu truoc');
    }
  }
  assert.equal(soEntry, 3, 'test can 3 entry (1 audio + 2 video)');

  // moof/traf: base_data_offset (neu co) dich dung delta va tro dung chunk; trun.data_offset (tuong doi) khong doi.
  const moofGoc = timHop(cayGoc, 'moof')!;
  const moofRa = timHop(cayRa, 'moof')!;
  assert.equal(moofRa.offset, moofGoc.offset + MEHD_SIZE);
  const trafsGoc = moofGoc.children.filter((h) => h.type === 'traf');
  const trafsRa = moofRa.children.filter((h) => h.type === 'traf');
  assert.equal(trafsRa.length, 2);
  for (let i = 0; i < 2; i++) {
    const tg = docTfhd(goc, trafsGoc[i].children.find((h) => h.type === 'tfhd')!);
    const tr = docTfhd(ra, trafsRa[i].children.find((h) => h.type === 'tfhd')!);
    assert.equal(tr.flags, tg.flags, 'flags tfhd khong doi');
    const doGoc = docTrunDataOffset(goc, trafsGoc[i].children.find((h) => h.type === 'trun')!);
    const doRa = docTrunDataOffset(ra, trafsRa[i].children.find((h) => h.type === 'trun')!);
    assert.equal(doRa, doGoc, 'trun.data_offset la tuong doi, khong duoc dich');
    const kyVong = tg.trackId === AUDIO_ID ? CHUNK_AUDIO : CHUNK_VIDEO;
    let dauMauGoc: number;
    let dauMauRa: number;
    if (tg.baseDataOffset !== undefined) {
      assert.equal(tr.baseDataOffset, tg.baseDataOffset + MEHD_SIZE, `base_data_offset track ${tg.trackId} phai cong 16`);
      assert.equal(tr.baseDataOffsetPos, tg.baseDataOffsetPos! + MEHD_SIZE, 'vi tri truong trong moof cung dich theo');
      dauMauGoc = tg.baseDataOffset + doGoc;
      dauMauRa = tr.baseDataOffset! + doRa;
    } else {
      assert.ok(tg.flags & TFHD_DEFAULT_BASE_IS_MOOF);
      dauMauGoc = moofGoc.offset + doGoc;
      dauMauRa = moofRa.offset + doRa;
    }
    assert.equal(chuoiTai(goc, dauMauGoc, kyVong.length), String.fromCharCode(...kyVong), 'tep goc: mau tro dung chunk');
    assert.equal(chuoiTai(ra, dauMauRa, kyVong.length), String.fromCharCode(...kyVong), 'tep ra: mau VAN tro dung chunk');
  }

  // mfra/tfra: moof_offset dich dung delta va van tro vao header 'moof'.
  const tfrasGoc = timTatCa(cayGoc, 'tfra');
  const tfrasRa = timTatCa(cayRa, 'tfra');
  assert.equal(tfrasRa.length, tfrasGoc.length);
  for (let i = 0; i < tfrasGoc.length; i++) {
    const g = docTfra(goc, tfrasGoc[i]);
    const r = docTfra(ra, tfrasRa[i]);
    assert.equal(r.version, g.version);
    for (let j = 0; j < g.entries.length; j++) {
      assert.equal(r.entries[j].pos, g.entries[j].pos + MEHD_SIZE);
      assert.equal(r.entries[j].moofOffset, g.entries[j].moofOffset + MEHD_SIZE, 'tfra.moof_offset phai cong 16');
      assert.equal(chuoiTai(goc, g.entries[j].moofOffset + 4, 4), 'moof');
      assert.equal(chuoiTai(ra, r.entries[j].moofOffset + 4, 4), 'moof', 'sau khi dich van tro vao moof');
    }
  }
  if (tfrasGoc.length) {
    const mfroGoc = timHop(cayGoc, 'mfra/mfro')!;
    const mfroRa = timHop(cayRa, 'mfra/mfro')!;
    assert.equal(docU32(ra, mfroRa.offset + 12), docU32(goc, mfroGoc.offset + 12), 'mfro (size mfra) khong doi');
  }

  // KHONG byte nao khac bi dong: ngoai 16 byte chen va cac truong da biet
  // (size moov/mvex, duration mvhd/tkhd/mdhd, entry stco/co64, base_data_offset,
  // tfra.moof_offset), moi byte cua tep ra phai bang byte tuong ung cua tep goc.
  const choPhepKhac = new Set<number>(); // vi tri trong TEP RA
  const danhDau = (pos: number, len: number) => { for (let k = 0; k < len; k++) choPhepKhac.add(pos + k); };
  danhDau(moovRa.offset, 4);
  danhDau(mvexRa.offset, 4);
  danhDau(mvhdRa.offset + 8 + 16, 4);
  for (const trak of moovRa.children.filter((h) => h.type === 'trak')) {
    danhDau(trak.children.find((h) => h.type === 'tkhd')!.offset + 8 + 20, 4);
    danhDau(timHop(trak.children, 'mdia/mdhd')!.offset + 8 + 16, 4);
  }
  for (const s of stcoRa) for (const e of docChunkOffsets(ra, s)) danhDau(e.pos, s.type === 'co64' ? 8 : 4);
  for (const traf of trafsRa) {
    const t = docTfhd(ra, traf.children.find((h) => h.type === 'tfhd')!);
    if (t.baseDataOffsetPos !== undefined) danhDau(t.baseDataOffsetPos, 8);
  }
  for (const t of tfrasRa) {
    const d = docTfra(ra, t);
    for (const e of d.entries) danhDau(e.pos, d.version === 1 ? 8 : 4);
  }
  let khac = 0;
  for (let p = 0; p < ra.length; p++) {
    if (p >= insertPos && p < insertPos + MEHD_SIZE) continue; // chinh hop mehd
    const pGoc = p >= insertPos ? p - MEHD_SIZE : p;
    if (ra[p] !== goc[pGoc] && !choPhepKhac.has(p)) khac++;
  }
  assert.equal(khac, 0, 'khong duoc dong vao byte nao ngoai cac truong da biet');
}

async function chayFix(goc: Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([goc as BlobPart], { type: 'video/mp4;codecs=avc1.42000a,mp4a.40.2' });
  const daVa = await fixVideoDuration(blob, ELAPSED_GIAY);
  assert.notEqual(daVa, blob);
  return new Uint8Array(await daVa.arrayBuffer());
}

test('mehd: chen vao mvex, moov/mvex dai them 16 byte, moi stco + base_data_offset + tfra dich dung va VAN tro dung byte cu', async () => {
  const goc = dungTepPhanManh({ tfhd: 'base-data-offset', tfraVersion: 1 });
  kiemTraDaChen(goc, await chayFix(goc));
});

test('mehd: nhanh co64 (chunk offset 64-bit) cung dich dung', async () => {
  const goc = dungTepPhanManh({ co64: true, tfhd: 'base-data-offset', tfraVersion: 0 });
  kiemTraDaChen(goc, await chayFix(goc));
});

test('mehd: bo cuc giong file Safari that — tfhd default-base-is-moof, khong mfra — trun.data_offset tuong doi van tro dung', async () => {
  const goc = dungTepPhanManh({ tfhd: 'default-base-is-moof', khongMfra: true });
  kiemTraDaChen(goc, await chayFix(goc));
});

test('mehd: da co san thi chi ghi de gia tri tai cho, khong doi kich thuoc, khong dich offset', async () => {
  const goc = dungTepPhanManh({ mehdSan: 5 });
  const ra = await chayFix(goc);
  assert.equal(ra.length, goc.length, 'khong duoc doi kich thuoc');

  const cayGoc = cayHop(goc);
  const cayRa = cayHop(ra);
  const mehdGoc = timHop(cayGoc, 'moov/mvex/mehd')!;
  const mehdRa = timHop(cayRa, 'moov/mvex/mehd')!;
  assert.equal(mehdRa.offset, mehdGoc.offset);
  assert.equal(docU32(goc, mehdGoc.offset + 12), 5, 'gia tri sai ban dau');
  assert.equal(docU32(ra, mehdRa.offset + 12), KY_VONG_MEHD, 'ghi de bang max(track that)');

  // Offset tuyet doi KHONG dich.
  for (const [g, r] of [...timTatCa(cayGoc, 'stco')].map((h, i) => [h, timTatCa(cayRa, 'stco')[i]] as const)) {
    assert.deepEqual(docChunkOffsets(ra, r), docChunkOffsets(goc, g));
  }
  const tfhdGoc = timTatCa(cayGoc, 'tfhd').map((h) => docTfhd(goc, h).baseDataOffset);
  const tfhdRa = timTatCa(cayRa, 'tfhd').map((h) => docTfhd(ra, h).baseDataOffset);
  assert.deepEqual(tfhdRa, tfhdGoc);
});

test('mehd: TU CHOI khi gap hop la — themMehd tra "tu-choi" va KHONG dong mot byte nao vao buffer', () => {
  const truongHop: TuyChonTep['hopLa'][] = ['sidx-cap-tep', 'saio-trong-stbl', 'meta-trong-moov', 'tfra-tro-sai'];
  for (const hopLa of truongHop) {
    const goc = dungTepPhanManh({ hopLa });
    const buf = goc.slice().buffer; // ban sao rieng
    const kq = themMehd(buf, 20.7);
    assert.equal(kq.kieu, 'tu-choi', `${hopLa}: phai tu choi`);
    assert.ok((kq as { lyDo: string }).lyDo.length > 0, 'phai co ly do');
    assert.deepEqual(new Uint8Array(buf), goc, `${hopLa}: buffer phai nguyen ven byte-for-byte`);
  }
});

test('mehd: khi tu choi, fixVideoDuration van vá tai cho (tang 1) nhung KHONG doi kich thuoc va KHONG chen mehd', async () => {
  const goc = dungTepPhanManh({ hopLa: 'sidx-cap-tep' });
  const ra = await chayFix(goc);
  assert.equal(ra.length, goc.length, 'khong duoc doi kich thuoc khi tu choi');
  // Cay hop van duyet duoc (sidx la hop la voi module nhung voi bo duyet test thi chi la la, khong duyet vao).
  const cayRa = cayHop(ra);
  assert.equal(timHop(cayRa, 'moov/mvex/mehd'), undefined, 'khong duoc chen mehd');
  const mvhd = timHop(cayRa, 'moov/mvhd')!;
  assert.equal(docU32(ra, mvhd.offset + 8 + 16), ELAPSED_GIAY * MOVIE_TIMESCALE, 'tang 1 van vá mvhd');
  // Ngoai cac truong duration tai cho, khong byte nao khac.
  const cayGoc = cayHop(goc);
  const choPhep = new Set<number>();
  const danhDau = (pos: number, len: number) => { for (let k = 0; k < len; k++) choPhep.add(pos + k); };
  danhDau(mvhd.offset + 8 + 16, 4);
  for (const trak of timHop(cayGoc, 'moov')!.children.filter((h) => h.type === 'trak')) {
    danhDau(trak.children.find((h) => h.type === 'tkhd')!.offset + 8 + 20, 4);
    danhDau(timHop(trak.children, 'mdia/mdhd')!.offset + 8 + 16, 4);
  }
  let khac = 0;
  for (let p = 0; p < ra.length; p++) if (ra[p] !== goc[p] && !choPhep.has(p)) khac++;
  assert.equal(khac, 0);
});

test('mehd: tep khong phan manh (khong co mvex) thi khong can — kich thuoc giu nguyen', async () => {
  const goc = tepMp4(1000, 5_000);
  const daVa = await fixVideoDuration(new Blob([goc as BlobPart], { type: 'video/mp4' }), 10);
  assert.equal((await daVa.arrayBuffer()).byteLength, goc.length);
  assert.deepEqual(themMehd(goc.slice().buffer, 10), { kieu: 'khong-can' });
});
