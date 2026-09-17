/**
 * Tach bai theo CUON SACH (issue #64) — phan THUAN cua lib/ai.ts, khong can DB:
 *
 *   1. Loi nhac he thong: luat "mot cuon sach = mot bai" nam SAN trong PROMPT,
 *      khong phu thuoc nha da khai sach hay chua — nha chua khai cuon nao thi loi
 *      nhac y nhu cu (khong co khoi sach). Khoi sach chi ghep them khi co, co tran
 *      (MAX_SACH_TRONG_PROMPT), ten dai bi cat, ten trong bi bo, ten nhieu dong
 *      ep ve mot dong.
 *   2. extractAssignments GUI dung loi nhac do len (fetch gia): co sach thi khoi
 *      sach di kem, khong sach thi khong — va van doc ket qua nhu cu. Bai gop ca
 *      cuon giu duoc thoi luong CONG lai (tran cua AI la 60, khong con 15: kep ve
 *      15 thi dong ho reo giua chung va +1 "xong som" thanh khong the dat).
 *   3. splitByRule (duong lui khong AI) gop theo cung nguyen tac o muc no lam
 *      duoc: cung mon + cung dang trang/so bai + cung ngon ngu, hoac cung mot cuon
 *      bo me da khai (bang chung manh nen bo qua ngon ngu); co quay video la HOAC
 *      cua cac dong gop, khong phai dieu kien chan gop; va cac GIOI HAN co y (mot
 *      dong nhac ten sach, dong kia khong -> khong gop) ghim lai de doi la biet.
 *
 * Hoi quy "nha chua khai sach thi chay y nhu truoc": moi ca duoi day chay ca hai
 * lan — sach rong va sach co — o cho nao hai ket qua PHAI giong nhau thi khang
 * dinh giong nhau.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Book } from './types.ts';

// hasAI doc bien moi truong LUC NAP module -> dat truoc khi import
process.env.NOUS_API_KEY = 'test-key';
const {
  extractAssignments, khoiSachChoAI, loiNhacHeThong, MAX_SACH_TRONG_PROMPT, splitByRule,
} = await import('./ai.ts');

const sach = (name: string, subject: Book['subject'] = null, id = name): Book =>
  ({ id, name, subject, childIds: null });

const POTH = sach('Poth Math', 'Toán');

test('PROMPT co san luat gop theo cuon sach, khong can nha khai sach', () => {
  const goc = loiNhacHeThong([]);
  // MOT khang dinh rong: loi nhac phat di phai noi den viec tach theo cuon sach.
  // Khong ghim nguyen van vi du hay thu tu cau — doi cach dien dat ma van cung mot
  // luat thi khong duoc lam do bai kiem nay.
  assert.match(goc, /cuốn sách/i);
  // Khong co khoi sach khi khong co sach
  assert.doesNotMatch(goc, /SÁCH \/ VỞ \/ NGUỒN BÀI TẬP BỐ MẸ ĐÃ KHAI/);
  assert.equal(khoiSachChoAI([]), '');
});

test('khoi sach: ten + mon, ghep SAU prompt goc, tran so cuon, cat ten dai, bo ten trong, ep mot dong', () => {
  const ds = [POTH, sach('Tiếng Việt tập 1', 'Tiếng Việt'), sach('Vở ô ly'), sach('   '), sach('Sách\nhai\n dòng')];
  const khoi = khoiSachChoAI(ds);
  assert.match(khoi, /^SÁCH \/ VỞ \/ NGUỒN BÀI TẬP BỐ MẸ ĐÃ KHAI/);
  assert.match(khoi, /\n- Poth Math \(môn Toán\)\n/);
  assert.match(khoi, /\n- Tiếng Việt tập 1 \(môn Tiếng Việt\)\n/);
  assert.match(khoi, /\n- Vở ô ly\n/, 'sach chua ro mon: chi ten');
  assert.match(khoi, /\n- Sách hai dòng\n/, 'ten nhieu dong ep ve mot dong');
  assert.equal((khoi.match(/^- /gm) ?? []).length, 4, 'ten trong bi bo');
  assert.match(khoi, /KHÔNG bịa bài từ danh sách này/);

  const day = loiNhacHeThong(ds);
  assert.ok(day.startsWith(loiNhacHeThong([])), 'prompt goc giu nguyen o dau');
  assert.ok(day.endsWith(khoi));

  // Tran: 40 cuon -> chi 30 dong
  const nhieu = Array.from({ length: MAX_SACH_TRONG_PROMPT + 10 }, (_, i) => sach(`Cuốn ${i + 1}`));
  const khoiNhieu = khoiSachChoAI(nhieu);
  assert.equal((khoiNhieu.match(/^- /gm) ?? []).length, MAX_SACH_TRONG_PROMPT);
  assert.match(khoiNhieu, /- Cuốn 1\n/);
  assert.doesNotMatch(khoiNhieu, /- Cuốn 31\n/);

  // Ten dai qua MAX_CHU_TEN_SACH (60) bi cat
  const dai = khoiSachChoAI([sach('A'.repeat(100))]);
  assert.match(dai, new RegExp(`- ${'A'.repeat(60)}\n`));
  assert.doesNotMatch(dai, /A{61}/);
});

test('extractAssignments gui loi nhac co khoi sach khi co sach, y nhu cu khi khong — va doc ket qua nhu cu', async () => {
  const daGui: { body: Record<string, unknown> }[] = [];
  const fetchGoc = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    daGui.push({ body: JSON.parse(String(init?.body)) });
    const baiTap = [{
      subject: 'Toán', content: 'Làm bài toán trang 41, 42, 43',
      note: 'Sách Poth Math — trang 41, 42, 43', lang: 'vi', duration_minutes: 12, canQuayVideo: false,
    }];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ baiTap }) } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const text = 'làm bài tập toán trang 41, 42, 43 ở sách poth math';
    const khongSach = await extractAssignments({ text });
    const coSach = await extractAssignments({ text, sach: [POTH] });

    const heThong = (i: number) => (daGui[i].body.messages as { role: string; content: string }[])[0];
    assert.equal(heThong(0).role, 'system');
    assert.equal(heThong(0).content, loiNhacHeThong([]), 'khong sach: dung loi nhac goc');
    assert.equal(heThong(1).content, loiNhacHeThong([POTH]));
    assert.match(heThong(1).content, /- Poth Math \(môn Toán\)/);
    // Phan con lai cua request khong doi theo sach
    assert.equal(daGui[0].body.model, daGui[1].body.model);
    assert.deepEqual(daGui[0].body.response_format, daGui[1].body.response_format);

    // Ket qua doc ra nhu cu
    for (const kq of [khongSach, coSach]) {
      assert.equal(kq.length, 1);
      assert.equal(kq[0].subject, 'Toán');
      assert.equal(kq[0].note, 'Sách Poth Math — trang 41, 42, 43');
      assert.equal(kq[0].durationMinutes, 12);
      assert.equal(kq[0].confidence, 1);
    }
  } finally {
    globalThis.fetch = fetchGoc;
  }
});

test('bai gop ca cuon giu duoc thoi luong CONG lai: 24 phut khong bi kep ve 15; tren 60 moi kep', async () => {
  const fetchGoc = globalThis.fetch;
  const traVe = (duration_minutes: unknown) => (async () =>
    new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ baiTap: [{
        subject: 'Toán', content: 'Làm bài toán trang 41, 42, 43',
        note: 'Sách Poth Math — trang 41, 42, 43', lang: 'vi', duration_minutes, canQuayVideo: false,
      }] }) } }],
    }), { status: 200 })) as typeof fetch;
  const text = 'làm bài tập toán trang 41, 42, 43 ở sách poth math';
  try {
    // Ba trang ~8 phut moi trang: bai gop phai giu nguyen 24, khong con tran 15
    for (const sachCuaNha of [[], [POTH]]) {
      globalThis.fetch = traVe(24);
      const kq = await extractAssignments({ text, sach: sachCuaNha });
      assert.equal(kq[0].durationMinutes, 24, `sach: ${sachCuaNha.length}`);
    }
    // Hai dau khoang van kep: duoi 5 len 5, tren 60 ve 60, so hong ve mac dinh 10
    for (const [tra, mong] of [[2, 5], [90, 60], ['x', 10]] as const) {
      globalThis.fetch = traVe(tra);
      assert.equal((await extractAssignments({ text }))[0].durationMinutes, mong, `tra ${tra}`);
    }
  } finally {
    globalThis.fetch = fetchGoc;
  }
});

/* ---------------- splitByRule: duong lui khong AI ----------------
 *
 * Moi dong cua BANG DIEU KIEN GOP o chu thich cungCuon (lib/ai.ts) co mot bai
 * kiem duoi day, kiem qua HANH VI cua splitByRule:
 *
 *   co ten sach, cung cuon        -> 'khai sach: hai dong nhac CUNG cuon'
 *   co ten sach, khac cuon        -> 'hai cuon KHAC nhau cung mon'
 *   co ten sach, khac mon         -> 'cung mot cuon nhung KHAC mon'
 *   co ten sach, viec doc lap     -> 'viec doc lap ... KHONG bi nuot'
 *   co ten sach, khac ngon ngu    -> 'cung mot cuon da khai la bang chung manh'
 *   khong ten sach, du dieu kien  -> 'cung mon + cung dang trang/so bai lien nhau'
 *   khong ten sach, thieu mot dieu kien (khong chi trang / mon "Khác" / khac ngon
 *                                  ngu) -> 'KHONG gop (khong ten sach)'
 *   mot dong co ten sach, dong kia khong -> 'GIOI HAN co y'
 */

const noiDung = (ds: { content: string }[]) => ds.map((d) => d.content);

test('mot dong "trang 41, 42, 43 sach Poth Math" -> MOT bai, ca khi khong co sach lan khi co', () => {
  const text = 'làm bài tập toán trang 41, 42, 43 ở sách poth math';
  const khong = splitByRule(text);
  const co = splitByRule(text, undefined, [POTH]);
  assert.equal(khong.length, 1);
  assert.equal(co.length, 1);
  assert.equal(khong[0].subject, 'Toán');
  assert.equal(khong[0].note, null, 'khong khai sach thi khong biet ten sach');
  assert.equal(co[0].note, 'Poth Math', 'khai sach thi ten sach len ghi chu (nhu AI ghi vao note)');
  assert.equal(co[0].subject, 'Toán');
});

test('cung mon + cung dang trang/so bai lien nhau -> gop; mon khac -> tach (khong can khai sach)', () => {
  const ds = splitByRule('Toán trang 41\nToán trang 42\nTiếng Việt tập đọc trang 20');
  assert.deepEqual(noiDung(ds), ['Toán trang 41; Toán trang 42', 'Tiếng Việt tập đọc trang 20']);
  assert.equal(ds[0].subject, 'Toán');
  assert.equal(ds[1].subject, 'Tiếng Việt');
  assert.equal(ds[0].confidence, 0.3, 'van la ban tach tam');
});

test('KHONG gop (khong ten sach): dong khong chi trang, mon "Khác", khac ngon ngu', () => {
  // dong thu hai khong chi trang (du cung mon)
  assert.equal(splitByRule('Toán trang 41\nToán: quay video đọc bảng cộng').length, 2);
  // "bài" phai kem so: "làm bài tập" khong phai dau hieu trang
  assert.equal(splitByRule('Toán trang 41\nToán: làm bài tập vào vở').length, 2);
  // mon "Khác" thi khong biet gi de gop
  assert.equal(splitByRule('Trang 41\nTrang 42').length, 2);
  // khac ngon ngu (en / vi) — cung mon Tieng Anh, cung co trang, khong ten sach
  const en = splitByRule('Unit 3 page 5\nTiếng Anh trang 6');
  assert.equal(en.length, 2);
  assert.deepEqual(en.map((d) => d.lang), ['en', 'vi']);
});

test('thoi luong CONG theo so dong da gop, kep o tran 60 — khong con mot muc mac dinh cho ca cuon', () => {
  const mot = splitByRule('Toán trang 41');
  assert.equal(mot[0].durationMinutes, 10, 'mot dong: y nhu truoc');

  const ba = splitByRule('Toán trang 41\nToán trang 42\nToán trang 43');
  assert.equal(ba.length, 1, 'ba trang cung cuon -> mot bai');
  assert.equal(ba[0].durationMinutes, 30, 'ba phan thi bai gop duoc ba lan thoi gian');

  // Mon khac khong gop -> moi bai giu uoc luong cua rieng no
  const haiBai = splitByRule('Toán trang 41\nToán trang 42\nTiếng Việt tập đọc trang 20');
  assert.deepEqual(haiBai.map((d) => d.durationMinutes), [20, 10]);

  // Gop nhieu qua thi kep o tran cua AI (DURATION_MAX = 60), khong troi tu do
  const bayDong = Array.from({ length: 7 }, (_, i) => `Toán trang ${41 + i}`).join('\n');
  const gopNhieu = splitByRule(bayDong);
  assert.equal(gopNhieu.length, 1);
  assert.equal(gopNhieu[0].durationMinutes, 60);
});

test('cung mot cuon nhung KHAC mon -> hai the, moi the giu dung mon cua no', () => {
  const VO = sach('Vở ô ly');   // bo me khai cuon vo ma chua chon mon
  const ds = splitByRule('Vở ô ly: chép bài toán trang 3\nVở ô ly: viết chính tả trang 4', undefined, [VO]);

  assert.equal(ds.length, 2, 'cung mot quyen vo khong co nghia la cung mot mon');
  assert.deepEqual(ds.map((d) => d.subject), ['Toán', 'Tiếng Việt']);
  assert.notEqual(ds[0].icon, ds[1].icon, 'moi the mang icon cua mon no');
  assert.deepEqual(ds.map((d) => d.note), ['Vở ô ly', 'Vở ô ly'], 'ca hai van la cuon do');

  // Cung cuon VA cung mon thi van gop nhu cu
  const gop = splitByRule('Vở ô ly: viết chính tả trang 3\nVở ô ly: chính tả trang 4', undefined, [VO]);
  assert.equal(gop.length, 1);
  assert.equal(gop[0].subject, 'Tiếng Việt');
});

test('viec doc lap (quay video, khong chi trang) KHONG bi nuot vao bai cua cuon dang gop', () => {
  const TOAN = sach('Toán', 'Toán');
  const ds = splitByRule('Toán trang 41\nToán: quay video đọc bảng cộng gửi cô', undefined, [TOAN]);

  assert.equal(ds.length, 2, 'hai viec khac nhau du cung nhac ten cuon "Toán"');
  assert.equal(ds[0].requiresVideo, false, 'phan viet van tick xong duoc, khong doi quay');
  assert.equal(ds[1].requiresVideo, true);

  // Ca hai dong deu chi trang thi van gop, ke ca khi mot dong doi quay video
  const gop = splitByRule('Toán trang 41\nToán trang 42, đọc to cho cô nghe', undefined, [TOAN]);
  assert.equal(gop.length, 1);
  assert.equal(gop[0].requiresVideo, true);
});

test('gop thi co quay video la HOAC cua hai dong (mot dong doi "đọc to" -> ca bai gop phai quay)', () => {
  const ds = splitByRule('Tiếng Việt tập 1 trang 10\nTiếng Việt tập 1 trang 11, đọc to cho bố mẹ nghe');
  assert.equal(ds.length, 1);
  assert.equal(ds[0].requiresVideo, true);
  assert.equal(ds[0].subject, 'Tiếng Việt');
});

test('cung mot cuon da khai la bang chung manh: gop ke ca khi mot dong bi doan la tieng Anh vi khong co dau', () => {
  // "Poth Math tr. 44" khong co dau tieng Viet -> lang 'en'; dong kia 'vi'. Cung cuon -> van MOT bai, doc giong Viet.
  const ds = splitByRule('Toán: làm bài tập trang 41, 42, 43 ở sách poth math\nPoth Math tr. 44', undefined, [POTH]);
  assert.equal(ds.length, 1);
  assert.equal(ds[0].lang, 'vi');
  assert.equal(ds[0].note, 'Poth Math');
  assert.equal(ds[0].subject, 'Toán');
  // Khong khai sach: dong thu hai la "Khác" (va 'en') -> hai bai, nhu cu
  assert.equal(splitByRule('Toán: làm bài tập trang 41, 42, 43 ở sách poth math\nPoth Math tr. 44').length, 2);
});

test('khai sach: hai dong nhac CUNG cuon -> gop (ke ca viet thuong, viet tat "tr."), lay mon cua cuon', () => {
  const ds = splitByRule('Poth Math tr. 41\npoth math trang 42', undefined, [POTH]);
  assert.deepEqual(noiDung(ds), ['Poth Math tr. 41; poth math trang 42']);
  assert.equal(ds[0].subject, 'Toán', 'dong khong lo mon lay mon cua cuon');
  assert.equal(ds[0].note, 'Poth Math');
  // Cung noi dung ma nha CHUA khai: hai dong "Khác" -> hai bai (hanh vi cu)
  const cu = splitByRule('Poth Math tr. 41\npoth math trang 42');
  assert.equal(cu.length, 2);
  assert.equal(cu[0].subject, 'Khác');
});

test('hai cuon KHAC nhau cung mon -> hai bai; ten dai hon thang khi mot ten la mot phan ten kia', () => {
  const SGK = sach('SGK Toán', 'Toán');
  const VBT = sach('Vở bài tập Toán', 'Toán');
  const ds = splitByRule('SGK Toán trang 30\nVở bài tập Toán trang 12', undefined, [SGK, VBT]);
  assert.equal(ds.length, 2);
  assert.deepEqual(ds.map((d) => d.note), ['SGK Toán', 'Vở bài tập Toán']);

  // Bo me khai ca "Toán" lan "Vở bài tập Toán": dong VBT phai ra cuon VBT
  const TOAN = sach('Toán', 'Toán');
  const uuTien = splitByRule('Vở bài tập Toán trang 12', undefined, [TOAN, VBT]);
  assert.equal(uuTien[0].note, 'Vở bài tập Toán');
  // Ten sach duoi 3 ky tu khong khop bua
  const ngan = splitByRule('Toán trang 41', undefined, [sach('T', 'Toán')]);
  assert.equal(ngan[0].note, null);
});

test('GIOI HAN co y: mot dong nhac ten sach, dong sau chi ghi trang -> khong gop (khong biet cuon nao)', () => {
  const ds = splitByRule('Poth Math trang 41\ntrang 42, 43', undefined, [POTH]);
  assert.equal(ds.length, 2);
  assert.deepEqual(ds.map((d) => d.note), ['Poth Math', null]);
});
