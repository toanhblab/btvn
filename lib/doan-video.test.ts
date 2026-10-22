/**
 * Doan "bai nay co phai quay video khong" bang AI thay vi khop chu cung
 * (captain 2026-10-22: "doi khi co viet la quay 1 video").
 *
 *   1. doanQuayVideo gui DUNG luat QUY_TAC_VIDEO len AI (fetch gia) va tra ket
 *      qua theo dung thu tu; AI tra sai so phan tu thi NEM, khong doan bua.
 *   2. apDoanVideo ap ket qua vao hai nua vua tach, giu luat thu bac cua banNhap:
 *      khong nua nao quay thi co o lai nua dau; the bo me da sua chu thi bo qua.
 *   3. Loi nhac tach bai cung mang luat moi (cac kieu viet "quay 1 video",
 *      "ghi hình"...), khong chi "quay video".
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apDoanVideo, maBanNhapMoi, type BanNhap } from './banNhap.ts';

// hasAI doc bien moi truong LUC NAP module -> dat truoc khi import
process.env.NOUS_API_KEY = 'test-key';
const { doanQuayVideo, extractAssignments } = await import('./ai.ts');

const phanHoi = (noiDung: unknown) => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify(noiDung) } }],
}), { status: 200 });
const traLoi = (noiDung: unknown) => (async () => phanHoi(noiDung)) as typeof fetch;

test('doanQuayVideo: gui luat quay video len AI va tra dung thu tu', async () => {
  const fetchGoc = globalThis.fetch;
  let body: { messages: { role: string; content: string }[]; response_format: { json_schema: { name: string } } } | null = null;
  globalThis.fetch = (async (_u: string | URL | Request, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return phanHoi({ ketQua: [{ canQuayVideo: true }, { canQuayVideo: false }] });
  }) as typeof fetch;
  try {
    const kq = await doanQuayVideo(['Quay 1 video con kể lại câu chuyện', 'Viết đoạn văn vào vở']);
    assert.deepEqual(kq, [true, false]);
    const he = body!.messages[0].content;
    assert.match(he, /quay 1 video/, 'luat co neu ro kieu viet "quay 1 video"');
    assert.match(he, /ghi hình/);
    assert.match(he, /ĐÚNG 2 phần tử/);
    assert.match(body!.messages[1].content, /1\. Quay 1 video con kể lại câu chuyện\n2\. Viết đoạn văn vào vở/);
    assert.equal(body!.response_format.json_schema.name, 'doan_video');
  } finally {
    globalThis.fetch = fetchGoc;
  }
});

test('doanQuayVideo: AI tra sai so phan tu hoac HTTP loi thi NEM — ben goi giu ket qua tam', async () => {
  const fetchGoc = globalThis.fetch;
  try {
    globalThis.fetch = traLoi({ ketQua: [{ canQuayVideo: true }] });
    await assert.rejects(doanQuayVideo(['a', 'b']), /SAI_SO_PHAN_TU/);
    globalThis.fetch = (async () => new Response('nope', { status: 404 })) as typeof fetch;
    await assert.rejects(doanQuayVideo(['a']), /HTTP 404/);
  } finally {
    globalThis.fetch = fetchGoc;
  }
});

test('loi nhac tach bai mang cung luat quay video moi', async () => {
  const fetchGoc = globalThis.fetch;
  let he = '';
  globalThis.fetch = (async (_u: string | URL | Request, init?: RequestInit) => {
    he = JSON.parse(String(init?.body)).messages[0].content;
    return phanHoi({ baiTap: [] });
  }) as typeof fetch;
  try {
    await extractAssignments({ text: 'Quay 1 video đọc bài' });
    assert.match(he, /quay 1 video/);
    assert.match(he, /Đoán theo NGHĨA/);
  } finally {
    globalThis.fetch = fetchGoc;
  }
});

const the = (content: string, requiresVideo: boolean): BanNhap => ({
  ma: maBanNhapMoi(), subject: 'Tiếng Việt', icon: '📖', content, note: null, lang: 'vi',
  confidence: 1, media: [], durationStr: '10', requiresVideo,
});

test('apDoanVideo: dung ket qua AI cho tung nua', () => {
  const dau = the('Viết đoạn văn vào vở', true);
  const sau = the('Quay 1 đoạn video con đọc bài', false); // luoi tho bo sot
  const kq = apDoanVideo([dau, sau], dau, sau, [false, true]);
  assert.deepEqual(kq.map((d) => d.requiresVideo), [false, true]);
});

test('apDoanVideo: khong nua nao quay thi co o lai nua dau (luat thu bac cua banNhap)', () => {
  const dau = the('Phần đầu', true);
  const sau = the('Phần sau', false);
  assert.deepEqual(apDoanVideo([dau, sau], dau, sau, [false, false]).map((d) => d.requiresVideo), [true, false]);
});

test('apDoanVideo: the bo me da sua chu trong luc cho AI thi khong dung toi', () => {
  const dau = the('Phần đầu', true);
  const sau = the('Quay 1 video', false);
  const daSua = { ...sau, content: 'Chép bài thơ vào vở' };
  const kq = apDoanVideo([dau, daSua], dau, sau, [false, true]);
  assert.equal(kq[1].requiresVideo, false, 'cau tra loi cua AI la cho noi dung cu');
  assert.equal(kq[0].requiresVideo, false);
});
