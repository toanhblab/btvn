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
