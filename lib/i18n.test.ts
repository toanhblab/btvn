/**
 * Lop dich (issue #46) — ba dieu ve HANH VI de vo ma khong ai thay:
 *
 *   1. Ba tu dien du khoa, khong rong, khong con dau tieng Viet, va giu dung
 *      cac tham so `{n}` cua cau goc (thieu tham so la hien "{n}" ra man).
 *   2. `dich`/`dienTham`: tieng Viet tra ve chinh khoa, tham so duoc dien, khoa
 *      thieu ban dich (khong the xay ra nho TypeScript) thi roi ve tieng Viet.
 *   3. Ba ma PIN demo la cua ba ngon ngu dung nhu captain chot (1111 Nhat, 2222
 *      Han, 3333 Anh) va bi giu cho.
 *
 * Phep "khong mot cau tieng Viet nao nam ngoai T(...)" KHONG o day: bang chung
 * cua no la ky tu trong MA NGUON chu khong phai app chay ra gi, nen no la mot
 * buoc quet ma nguon — `npm run quet:chu-viet` (scripts/quet-chu-viet.mjs).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EN, type Key } from './i18n/en.ts';
import { JA } from './i18n/ja.ts';
import { KO } from './i18n/ko.ts';
import { dich, dienTham, taoT, TU_DIEN } from './i18n/chu.ts';
import { NGON_NGU, PIN_DEMO, ngonNguOf, pinDanhRieng } from './i18n/ngonNgu.ts';

const DAU_TIENG_VIET =
  /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵĂÂĐÊÔƠƯÀÁẢÃẠẦẤẨẪẬẰẮẲẴẶÈÉẺẼẸỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌỒỐỔỖỘỜỚỞỠỢÙÚỦŨỤỪỨỬỮỰỲÝỶỸỴ]/;

const KHOA = new Set<string>(Object.keys(EN));

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
  // Khoa cua nguyen mau Object: toan tu `in` tra true cho ca ba, `Object.hasOwn` thi khong.
  // Vi tu nay gac attemptPin / ganMaySauKhiNhapPin / createFamily / changePin.
  for (const k of ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__']) {
    assert.equal(pinDanhRieng(k), false, k);
  }
});
