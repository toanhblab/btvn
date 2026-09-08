/**
 * QUET MA NGUON, khong phai test hanh vi (issue #46).
 *
 *   npm run quet:chu-viet
 *
 * Doc moi tep giao dien (app/**, lib/** tru test va tu dien), bo chu thich, bo
 * cac cau da boc `T('…')` va cac literal la KHOA dich, con lai ma van co dau
 * tieng Viet thi do la mot cau chua qua lop dich — khach hang xem demo tieng
 * Nhat se nhin thay no dau tien.
 *
 * CO Y dat o day chu khong o `npm test`: bang chung duy nhat cua no la KY TU NAO
 * CO TRONG MA NGUON, khong phai app chay ra gi. Mot cau tieng Viet trong ma chet
 * van bi bao, va mot lan doi ten bien khong doi hanh vi cung co the lam no doi
 * mau. Do la viec cua mot buoc kiem ma nguon (lint), khong phai cua bo kiem thu.
 * Nhung dieu ve HANH VI cua lop dich (tu dien du khoa, `dich`/`dienTham`, PIN
 * demo) van nam o lib/i18n.test.ts.
 *
 * Thoat 0 = sach, 1 = con cau chua dich (in ra tep:dong).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EN } from '../lib/i18n/en.ts';

export const DAU_TIENG_VIET =
  /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵĂÂĐÊÔƠƯÀÁẢÃẠẦẤẨẪẬẰẮẲẴẶÈÉẺẼẸỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌỒỐỔỖỘỜỚỞỠỢÙÚỦŨỤỪỨỬỮỰỲÝỶỸỴ]/;

/**
 * Tep / doan duoc phep co dau tieng Viet ngoai T(...). Moi muc PHAI kem mot dong
 * ly do: mien tru khong co ly do thi lan sau khong ai dam bo di.
 */
const MIEN_TRU = {
  // Prompt cho AI va bang tu khoa doan mon la CHU GUI CHO MAY, khong hien len man.
  'lib/ai.ts': [/[\s\S]*/],
  // Bang chu cai dung de NHAN DIEN tieng Viet trong de bai (regex), khong hien.
  'lib/speech.ts': [/\/\[[^\]]*\]\/i/],
  // Bo dau de dat ten tep video nop cho co (regex), khong hien.
  'app/bome/(khung)/nop-co/page.tsx': [/\.replace\(\/[đĐ]\/g, '[dD]'\)/g],
};

function* tepGiaoDien(dir) {
  for (const ten of readdirSync(dir)) {
    const p = join(dir, ten);
    if (statSync(p).isDirectory()) { yield* tepGiaoDien(p); continue; }
    if (!/\.tsx?$/.test(ten) || ten.endsWith('.test.ts')) continue;
    if (p.startsWith(join('lib', 'i18n'))) continue;
    yield p;
  }
}

const KHOA = new Set(Object.keys(EN));

/** Bo chu thich, cac cau `T('…')`, va literal la khoa dich — tra ve phan con lai. */
export function phanChuaDich(src, tep) {
  let s = src
    .replace(/\/\*[\s\S]*?\*\//g, '')          // /* … */ va {/* … */}
    .replace(/^\s*\/\/.*$/gm, '')               // dong chu thich
    .replace(/(\s)\/\/ .*$/gm, '$1');           // chu thich cuoi dong ("// " co dau cach; URL "://" khong khop)
  for (const re of MIEN_TRU[tep] ?? []) s = s.replace(re, '');
  // Literal da boc T(...) hoac dung lam khoa dich (HW_SOURCES.label, THU, LY_DO...)
  return s.replace(/'((?:[^'\\\n]|\\.)*)'/g, (m, noiDung) =>
    KHOA.has(noiDung.replace(/\\'/g, "'")) ? "''" : m
  );
}

export function quet() {
  const lot = [];
  for (const tep of [...tepGiaoDien('app'), ...tepGiaoDien('lib')]) {
    phanChuaDich(readFileSync(tep, 'utf8'), tep).split('\n').forEach((dong, i) => {
      if (DAU_TIENG_VIET.test(dong)) lot.push(`${tep}:${i + 1}: ${dong.trim()}`);
    });
  }
  return lot;
}

const lot = quet();
if (lot.length > 0) {
  console.error(`✗ ${lot.length} cau tieng Viet chua qua T(...):`);
  for (const d of lot) console.error(`  ${d}`);
  process.exit(1);
}
console.log('✓ Khong cau tieng Viet nao nam ngoai T(...) trong tep giao dien');
