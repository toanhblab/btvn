/**
 * QUET MA NGUON, khong phai test hanh vi (issue #46).
 *
 *   npm run quet:chu-viet
 *
 * Doc moi tep giao dien (app/**, lib/** tru test va tu dien), bo chu thich, bo
 * cac cau da boc `T('…')` va cac literal la KHOA dich, roi bao ba thu:
 *
 *   1. Con dau tieng Viet  -> chac chan mot cau chua qua lop dich.
 *   2. (app/**) Doan chu TRAN trong JSX, tuc `>p>Chu</p>` chu khong phai
 *      `<p>{T('Chu')}</p>`.
 *   3. (app/**) Gia tri chuoi cua thuoc tinh HIEN LEN MAN (placeholder,
 *      aria-label, title, alt), tuc `placeholder="Chu"` chu khong phai
 *      `placeholder={T('Chu')}`.
 *
 * Vi sao can (2) va (3): phep do cu chi la mot lop ky tu CO DAU, nen tieng Viet
 * KHONG DAU ("xong", "Giao cho", "Quay xong") lot qua im lang — dung ba cau nhu
 * vay da ra toi ban demo. Hai phep sau khong phu thuoc dau nen bao oan nhieu hon
 * (chu tieng Anh, ky hieu, chu cua thu vien): CHAP NHAN, cai nao oan that thi
 * them vao MIEN_TRU kem mot dong ly do.
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
  'lib/ai.ts': [
    // Khuon mau prompt va doan de bai ghep vao prompt: CHU GUI CHO MAY, khong hien.
    /const PROMPT = `[\s\S]*?`;/,
    /`Nội dung bài tập:[^`]*`/,
    // Bang tu khoa doan mon / doan bai phai quay video: luoi NHAN DIEN, khong hien.
    /const HINTS: \[RegExp, string\]\[\] = \[[\s\S]*?\];/,
    /const VIDEO_HINT =[\s\S]*?;/,
    // Bang chu cai de do de bai co phai tieng Viet khong (regex), khong hien.
    /const DAU_TIENG_VIET =[\s\S]*?;/,
    /const viChars = .*;/,
  ],
  // O "Ten nha" CO Y hien chuoi goc: de trong thi nha moi luu dung chu do, va nha
  // moi luon bat dau o ui_locale 'vi' — dich goi y se hua mot ten khac ten se luu.
  'app/bome/tao-nha/TaoNha.tsx': [/placeholder="Nhà mình"/],
  // Bang chu cai dung de NHAN DIEN tieng Viet trong de bai (regex), khong hien.
  'lib/speech.ts': [/\/\[[^\]]*\]\/i/],
  // Bo dau de dat ten tep video nop cho co (regex trong boDau), khong hien.
  'lib/media.ts': [/\.replace\(\/[đĐ]\/g, '[dD]'\)/g],
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

/* Xoa mot doan nhung GIU nguyen so dong: bao cao chi dung neu so dong khop voi
   tep that, ma chu thich / muc mien tru thi hay dai nhieu dong. */
const xoaGiuDong = (m) => m.replace(/[^\n]/g, ' ');

/** Bo chu thich, cac cau `T('…')`, va literal la khoa dich — tra ve phan con lai. */
export function phanChuaDich(src, tep) {
  let s = src
    .replace(/\/\*[\s\S]*?\*\//g, xoaGiuDong)  // /* … */ va {/* … */}
    .replace(/^\s*\/\/.*$/gm, '')               // dong chu thich
    .replace(/(\s)\/\/ .*$/gm, '$1');           // chu thich cuoi dong ("// " co dau cach; URL "://" khong khop)
  for (const re of MIEN_TRU[tep] ?? []) s = s.replace(re, xoaGiuDong);
  // Literal da boc T(...) hoac dung lam khoa dich (HW_SOURCES.label, THU, LY_DO...)
  return s.replace(/'((?:[^'\\\n]|\\.)*)'/g, (m, noiDung) =>
    KHOA.has(noiDung.replace(/\\'/g, "'")) ? "''" : m
  );
}

/* Doan chu TRAN giua hai the JSX: `>Chu<`. Chu da dich nam trong `{T('…')}` nen
   khong bao gio la doan tran. Doi it nhat mot chu cai de bo qua `>{' '}<`, so, ky
   hieu; doi `<` mo mot the that va `>` khong phai duoi cua `=>`, `>=`, `-->` de
   khong dinh phai phep so sanh / ham mui ten trong ma JS.

   Doan chu duoc phep xuong dong (chu va the dong hay khac dong) nhung KHONG duoc
   chua `(`, `)`, `;`, `=`: khong the thi `useState<A>(x); const b = useState<B>`
   trong ma TypeScript trong y het mot doan chu giua hai the. Doi lai, cau hien
   len man co dau ngoac se lot — cau nhu vay hiem, va gan nhu luon da nam trong
   T(...) san. */
const CHU_TRAN_JSX = /(?<![=<>!-])>([^<>{}();=]*\p{L}[^<>{}();=]*)<(?=[/A-Za-z])/gu;

/* Doan chu di NGAY SAU mot bieu thuc: `{done}/{total} xong</span>`. Doan nay khong
   co `>` dung truoc nen luoi tren khong thay. Doi ben phai la `</` (the dong) —
   `}` la ky tu rat pho bien trong ma JS, khong siet thi dinh phai `} while (i < n)`. */
const CHU_SAU_BIEU_THUC = /\}([^<>{}();=]*\p{L}[^<>{}();=]*)<\//gu;

/* Ten ligature cua Material Symbols (`<span className="material-symbols-outlined">
   arrow_back</span>`) la MA CUA ICON, khong phai chu. Nhan ra bang CHINH THE chua
   no, khong doan theo hinh dang chu: mot tu thuong nhu "add"/"close" la ten icon
   that, nhung "xong" cung the ma lai la tieng Viet — doan theo hinh dang la bo lot. */
const laTenIcon = (src, viTri) => {
  const mo = src.lastIndexOf('<', viTri);
  return mo !== -1 && /material-symbols/.test(src.slice(mo, viTri));
};

/* Thuoc tinh HIEN LEN MAN dat bang chuoi thay vi {T('…')}. */
const THUOC_TINH_HIEN =
  /\b(?:placeholder|aria-label|title|alt|aria-placeholder|aria-description)\s*=\s*"([^"]*\p{L}[^"]*)"/gu;

/**
 * Cac doan chu hien len man nhung khong di qua T(...) — chi xet trong app/**.
 * Quet CA TEP chu khong tung dong: chu va the dong hay nam khac dong
 * (`{done}/{total} xong` xuong dong roi moi toi `</span>`).
 */
function chuNgoaiT(src) {
  const ra = [];
  const them = (chu, viTri) => {
    const gon = chu.replace(/\s+/g, ' ').trim();
    if (gon && !laTenIcon(src, viTri)) ra.push({ chu: gon, dong: soDong(src, viTri) });
  };
  for (const re of [CHU_TRAN_JSX, CHU_SAU_BIEU_THUC]) {
    for (const m of src.matchAll(re)) them(m[1], m.index);
  }
  for (const m of src.matchAll(THUOC_TINH_HIEN)) them(m[0], m.index);
  return ra;
}

const soDong = (src, viTri) => src.slice(0, viTri).split('\n').length;

export function quet() {
  const lot = [];
  for (const tep of [...tepGiaoDien('app'), ...tepGiaoDien('lib')]) {
    const conLai = phanChuaDich(readFileSync(tep, 'utf8'), tep);
    conLai.split('\n').forEach((dong, i) => {
      if (DAU_TIENG_VIET.test(dong)) lot.push(`${tep}:${i + 1}: ${dong.trim()}`);
    });
    if (!tep.startsWith('app')) continue;
    // Chu tieng Viet KHONG DAU chi lo ra o day — doi chieu theo ca doan, khong theo dau
    for (const { chu, dong } of chuNgoaiT(conLai)) {
      if (!DAU_TIENG_VIET.test(chu)) lot.push(`${tep}:${dong}: chu ngoai T(...): ${chu}`);
    }
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
