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
import { pathToFileURL } from 'node:url';
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
  // Bang chu cai dung de NHAN DIEN tieng Viet trong de bai (regex), khong hien.
  'lib/speech.ts': [/\/\[[^\]]*\]\/i/],
  // Bo dau de dat ten tep video nop cho co (regex trong boDau), khong hien.
  'lib/media.ts': [/\.replace\(\/[đĐ]\/g, '[dD]'\)/g],

  /* Ba muc duoi day KHONG phai chu cua app ma la GIA TRI MAC DINH ghi vao DB luc
     tao nha moi — ma nha moi luon bat dau o ui_locale 'vi'. Dich chung thi ten
     that luu trong DB se khac chu bo me nhin thay luc go, va tu do khong doi lai
     duoc (chu bo me tu go thi app khong dich). */
  'lib/store.ts': [/export const VIEC_NHA_MAC_DINH = \[[\s\S]*?\];/],
  'app/api/families/route.ts': [/'Nhà mình'/],
  'app/bome/tao-nha/TaoNha.tsx': [/name\.trim\(\) \|\| 'Nhà mình'/],
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

/**
 * Bo chu thich va cac cau DA BOC `T('…')` — tra ve phan con lai.
 *
 * Chi bo literal nam NGAY SAU `T(`, khong bo moi literal trung khoa dich. Truoc
 * day bo theo khoa, va do la mot khoang lot that: mot cau da co trong tu dien (vi
 * cho khac dung roi) ma dung THO — `setError('Mã PIN không đúng.')`, thieu `T` —
 * vua bien dich duoc, vua qua duoc phep quet, vua hien chu Viet giua man tieng
 * Nhat. Cac bang KHAI BAO khoa (SUBJECTS, THU, TABS…) khong the phan biet bang
 * regex nen di vao MIEN_TRU kem mot dong ly do.
 */
/* Ten mon (va 'Việc nhà') vua la KHOA DICH vua la KHOA TRA CUU cua bang SUBJECTS.
   Ten mon LUU VAO DB la ban DA DICH — man nhap tay lay tu `subjectsFor(T)`, duong
   AI dich bang `tenMonTheoNha` truoc khi tra draft (lib/types.ts, lib/ai.ts) — nen
   chuoi tieng Viet o day chi con dung mot viec: TRA CUU (`SUBJECTS['Toán']`,
   `iconFor(x ?? 'Khác')`, `VIEC_NHA_SUBJECT`). Vi the chi mien o DONG nao that su
   noi ve mon hoc; gan vao mot bien roi ve ra man thi van bi bao.
   Guong theo SUBJECTS trong lib/types.ts — them mon moi ma quen o day thi phep
   quet do, tuc bao cho nguoi sua biet, dung chieu an toan. */
const KHOA_PHAN_LOAI = new Set([
  'Toán', 'Tiếng Việt', 'Tiếng Anh', 'Vẽ', 'Tự nhiên', 'Khác', 'Việc nhà',
]);

/* Dong "that su noi ve mon hoc": co nhac bang SUBJECTS, ham iconFor/subjectsFor,
   hoac chinh cai ten `subject` (ke ca VIEC_NHA_SUBJECT). */
const DONG_NOI_VE_MON = /SUBJECTS|iconFor|subjectsFor|subject/i;
/**
 * Doan `[mo, dong)` cua cau lenh `const` bat dau tai `mo` — can bang ()[]{}.
 *
 * Dung lai som o BA moc, vi mot cau thieu dau cham phay (ASI) khong duoc phep nuot
 * phan con lai cua tep roi mien tru moi khoa dung tho trong do:
 *   - `;` o do sau \u2264 0        (cau ket thuc binh thuong)
 *   - do sau < 0                (da chay qua dau `}` cua khoi bao ngoai)
 *   - dau dong moi o do sau 0 ma bat dau bang mot tu khoa khai bao
 */
const TU_KHOA_KHAI_BAO = /^\s*(?:export|import|function|class|const|let|var|type|interface|enum)\b/;

function thanCauLenh(s, mo) {
  let sau = 0;
  for (let i = mo; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[' || c === '{') sau++;
    else if (c === ')' || c === ']' || c === '}') {
      sau--;
      if (sau < 0) return [mo, i];
    } else if (c === ';' && sau <= 0) return [mo, i + 1];
    else if (c === '\n' && sau <= 0 && i > mo) {
      const dongSau = s.slice(i + 1, s.indexOf('\n', i + 1) === -1 ? s.length : s.indexOf('\n', i + 1));
      if (TU_KHOA_KHAI_BAO.test(dongSau)) return [mo, i];
    }
  }
  return [mo, s.length];
}

/**
 * Vi tri mot literal khoa dich duoc phep dung THO — moi vi tri o day deu la DU
 * LIEU, khong phai chu ve ra man:
 *
 *   1. Cau lenh `const` co kieu nhac toi `Key` — cac BANG khai bao khoa
 *      (SUBJECTS, THU, TABS, TEN_NGON_NGU, LY_DO_TRU_*, MAU.ten…). Dung chinh
 *      chu thich kieu lam dau, khong liet ke theo tep: them bang moi ma khai
 *      dung kieu la tu duoc, con quen kieu thi phep quet bao.
 *   2. `error: '…'` — CHI trong `lib/**`. Hop dong ghi o dau lib/auth.ts la: ham
 *      cua LIB tra ve khoa, ROUTE moi dich (`T(loi.error, loi.tham)`). Mien ca
 *      `app/**` thi mot route quen `T` se im lang tra chu Viet xuong client, ma
 *      client hien thang ra man (`setError(data.error)`) — dung hinh dang "quen T"
 *      de xay ra nhat trong repo nay (~60 cho `NextResponse.json({ error: T(…) })`).
 *   3. Ten mon / 'Việc nhà' — chi tren DONG noi ve mon hoc (DONG_NOI_VE_MON).
 */
function boLiteralKhoaODungCho(s, tep) {
  const bo = (doan) => doan.replace(/'((?:[^'\\\n]|\\.)*)'/g, (m, noiDung) =>
    KHOA.has(noiDung.replace(/\\'/g, "'")) ? "''" : m
  );

  // (1) cau lenh const co kieu nhac toi `Key`
  let ra = '';
  let i = 0;
  for (const m of s.matchAll(/\b(?:export\s+)?const\s+\w+/g)) {
    if (m.index < i) continue;
    const [mo, dong] = thanCauLenh(s, m.index);
    const than = s.slice(mo, dong);
    if (!/\bKey\b/.test(than)) continue;
    ra += s.slice(i, mo) + bo(than);
    i = dong;
  }
  ra += s.slice(i);

  // (2) hop dong "lib tra ve khoa, route dich" — CHI o lib/**
  if (tep.startsWith('lib')) {
    ra = ra.replace(/(\berror:\s*)'((?:[^'\\\n]|\\.)*)'/g, (m, mo, noiDung) =>
      KHOA.has(noiDung.replace(/\\'/g, "'")) ? `${mo}''` : m
    );
  }

  // (3) ten mon / 'Việc nhà' — chi tren dong noi ve mon hoc
  return ra
    .split('\n')
    .map((dong) =>
      DONG_NOI_VE_MON.test(dong)
        ? dong.replace(/'((?:[^'\\\n]|\\.)*)'/g, (m, noiDung) =>
            KHOA_PHAN_LOAI.has(noiDung.replace(/\\'/g, "'")) ? "''" : m
          )
        : dong
    )
    .join('\n');
}

export function phanChuaDich(src, tep) {
  let s = src
    .replace(/\/\*[\s\S]*?\*\//g, xoaGiuDong)  // /* … */ va {/* … */}
    .replace(/^\s*\/\/.*$/gm, '')               // dong chu thich
    .replace(/(\s)\/\/ .*$/gm, '$1');           // chu thich cuoi dong ("// " co dau cach; URL "://" khong khop)
  for (const re of MIEN_TRU[tep] ?? []) s = s.replace(re, xoaGiuDong);
  s = s.replace(/(\bT\(\s*)'((?:[^'\\\n]|\\.)*)'/g, (m, mo, noiDung) =>
    KHOA.has(noiDung.replace(/\\'/g, "'")) ? `${mo}''` : m
  );
  return boLiteralKhoaODungCho(s, tep);
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

/** Kiem MOT tep tu NOI DUNG cua no — khong doc dia, de bai kiem thu goi duoc. */
export function kiemTep(src, tep) {
  const lot = [];
  const conLai = phanChuaDich(src, tep);
  conLai.split('\n').forEach((dong, i) => {
    if (DAU_TIENG_VIET.test(dong)) lot.push(`${tep}:${i + 1}: ${dong.trim()}`);
  });
  if (!tep.startsWith('app')) return lot;
  // Chu tieng Viet KHONG DAU chi lo ra o day — doi chieu theo ca doan, khong theo dau
  for (const { chu, dong } of chuNgoaiT(conLai)) {
    if (!DAU_TIENG_VIET.test(chu)) lot.push(`${tep}:${dong}: chu ngoai T(...): ${chu}`);
  }
  return lot;
}

export function quet() {
  const lot = [];
  for (const tep of [...tepGiaoDien('app'), ...tepGiaoDien('lib')]) {
    lot.push(...kiemTep(readFileSync(tep, 'utf8'), tep));
  }
  return lot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lot = quet();
  if (lot.length > 0) {
    console.error(`✗ ${lot.length} cau tieng Viet chua qua T(...):`);
    for (const d of lot) console.error(`  ${d}`);
    process.exit(1);
  }
  console.log('✓ Khong cau tieng Viet nao nam ngoai T(...) trong tep giao dien');
}
