/**
 * Lop dich (issue #46) — ba dieu de vo ma khong ai thay:
 *
 *   1. KHONG MOT CHU VIET NAO LOT RA ngoai `T(...)`: quet MOI tep giao dien
 *      (app/**, lib/** tru test va tu dien), bo chu thich, bo cac cau da boc
 *      `T('…')` va cac literal la KHOA dich (HW_SOURCES, THU, LY_DO_TRU_GOI_Y...),
 *      con lai ma van co dau tieng Viet la mot cau chua dich — khach hang xem
 *      demo tieng Nhat se nhin thay no dau tien. Danh sach mien tru ghi o
 *      MIEN_TRU, moi muc mot ly do.
 *   2. Ba tu dien du khoa, khong rong, khong con dau tieng Viet, va giu dung
 *      cac tham so `{n}` cua cau goc (thieu tham so la hien "{n}" ra man).
 *   3. `dich`/`dienTham`: tieng Viet tra ve chinh khoa, tham so duoc dien, khoa
 *      thieu ban dich (khong the xay ra nho TypeScript) thi roi ve tieng Viet.
 *   4. Ba ma PIN demo la cua ba ngon ngu dung nhu captain chot (1111 Nhat, 2222
 *      Han, 3333 Anh) va bi giu cho.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EN, type Key } from './i18n/en.ts';
import { JA } from './i18n/ja.ts';
import { KO } from './i18n/ko.ts';
import { dich, dienTham, taoT, TU_DIEN } from './i18n/chu.ts';
import { NGON_NGU, PIN_DEMO, ngonNguOf, pinDanhRieng } from './i18n/ngonNgu.ts';

export const DAU_TIENG_VIET =
  /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵĂÂĐÊÔƠƯÀÁẢÃẠẦẤẨẪẬẰẮẲẴẶÈÉẺẼẸỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌỒỐỔỖỘỜỚỞỠỢÙÚỦŨỤỪỨỬỮỰỲÝỶỸỴ]/;

/** Tep / doan duoc phep co dau tieng Viet ngoai T(...) — moi muc mot ly do. */
const MIEN_TRU: Record<string, RegExp[]> = {
  // Prompt cho AI va bang tu khoa doan mon la CHU GUI CHO MAY, khong hien len man.
  'lib/ai.ts': [/[\s\S]*/],
  // Bang chu cai dung de NHAN DIEN tieng Viet trong de bai (regex), khong hien.
  'lib/speech.ts': [/\/\[[^\]]*\]\/i/],
  // Bo dau de dat ten tep video nop cho co (regex), khong hien.
  'app/bome/(khung)/nop-co/page.tsx': [/\.replace\(\/[đĐ]\/g, '[dD]'\)/g],
};

function* tepGiaoDien(dir: string): Generator<string> {
  for (const ten of readdirSync(dir)) {
    const p = join(dir, ten);
    if (statSync(p).isDirectory()) { yield* tepGiaoDien(p); continue; }
    if (!/\.tsx?$/.test(ten) || ten.endsWith('.test.ts')) continue;
    if (p.startsWith(join('lib', 'i18n'))) continue;
    yield p;
  }
}

const KHOA = new Set<string>(Object.keys(EN));

/** Bo chu thich, cac cau `T('…')`, va literal la khoa dich — tra ve phan con lai. */
export function phanChuaDich(src: string, tep: string): string {
  let s = src
    .replace(/\/\*[\s\S]*?\*\//g, '')          // /* … */ va {/* … */}
    .replace(/^\s*\/\/.*$/gm, '')               // dong chu thich
    .replace(/(\s)\/\/ .*$/gm, '$1');           // chu thich cuoi dong ("// " co dau cach; URL "://" khong khop)
  for (const re of MIEN_TRU[tep] ?? []) s = s.replace(re, '');
  // Literal da boc T(...) hoac dung lam khoa dich (HW_SOURCES.label, THU, LY_DO...)
  s = s.replace(/'((?:[^'\\\n]|\\.)*)'/g, (m, noiDung: string) =>
    KHOA.has(noiDung.replace(/\\'/g, "'")) ? "''" : m
  );
  return s;
}

test('khong mot cau tieng Viet nao nam ngoai T(...) trong tep giao dien', () => {
  const lot: string[] = [];
  for (const tep of [...tepGiaoDien('app'), ...tepGiaoDien('lib')]) {
    const conLai = phanChuaDich(readFileSync(tep, 'utf8'), tep);
    conLai.split('\n').forEach((dong, i) => {
      if (DAU_TIENG_VIET.test(dong)) lot.push(`${tep}:${i + 1}: ${dong.trim()}`);
    });
  }
  assert.deepEqual(lot, [], `Cau tieng Viet chua qua T(...):\n${lot.join('\n')}`);
});

test('ba tu dien du khoa, khong rong, khong con tieng Viet, giu dung tham so', () => {
  const khoa = Object.keys(EN) as Key[];
  assert.ok(khoa.length > 400, `tu dien co ${khoa.length} khoa — it bat thuong`);
  for (const [ten, td] of Object.entries(TU_DIEN)) {
    for (const k of khoa) {
      const v = td[k];
      assert.equal(typeof v, 'string', `${ten}: thieu khoa ${JSON.stringify(k)}`);
      assert.ok(v.trim().length > 0, `${ten}: ban dich rong cho ${JSON.stringify(k)}`);
      assert.ok(!DAU_TIENG_VIET.test(v), `${ten}: ban dich con tieng Viet: ${JSON.stringify(k)} -> ${v}`);
      const thamGoc = [...k.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const thamDich = [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      assert.deepEqual(thamDich, thamGoc, `${ten}: tham so lech o ${JSON.stringify(k)} -> ${v}`);
    }
    const thua = Object.keys(td).filter((k) => !KHOA.has(k));
    assert.deepEqual(thua, [], `${ten}: khoa khong co trong EN`);
  }
  // Tieng Anh la ban goc cua khoa: khong duoc "dich" bang cach chep lai cau Viet
  for (const k of khoa) assert.ok(!DAU_TIENG_VIET.test(EN[k]), `EN con tieng Viet: ${k}`);
  assert.equal(JA, TU_DIEN.ja);
  assert.equal(KO, TU_DIEN.ko);
});

test('dich va dien tham so', () => {
  assert.equal(dienTham('Còn {n} việc', { n: 3 }), 'Còn 3 việc');
  assert.equal(dienTham('{a} và {b}', { a: 'x' }), 'x và {b}', 'tham so thieu thi giu nguyen');
  assert.equal(dich('vi', '{n} việc', { n: 2 }), '2 việc');
  assert.equal(dich('en', '{n} việc', { n: 2 }), '2 to do');
  assert.equal(dich('ja', 'Hôm nay'), JA['Hôm nay']);
  assert.equal(dich('ko', 'Hôm nay'), KO['Hôm nay']);
  const T = taoT('en');
  assert.equal(T('Hôm nay'), 'Today');
  // Khoa chua co ban dich (chi xay ra khi tu dien bi sua tay sai) -> ve tieng Viet
  const td = TU_DIEN.en as unknown as Record<string, string>;
  const luu = td['Hôm nay'];
  delete td['Hôm nay'];
  assert.equal(dich('en', 'Hôm nay'), 'Hôm nay');
  td['Hôm nay'] = luu;
});

test('ngon ngu hop le va ba ma PIN demo', () => {
  assert.deepEqual([...NGON_NGU], ['vi', 'en', 'ja', 'ko']);
  assert.equal(ngonNguOf('ja'), 'ja');
  assert.equal(ngonNguOf('fr'), 'vi');
  assert.equal(ngonNguOf(null), 'vi');
  assert.deepEqual(PIN_DEMO, { '1111': 'ja', '2222': 'ko', '3333': 'en' });
  assert.ok(pinDanhRieng('1111') && pinDanhRieng('2222') && pinDanhRieng('3333'));
  assert.ok(!pinDanhRieng('1234') && !pinDanhRieng('4444') && !pinDanhRieng(''));
});
