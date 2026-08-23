/**
 * Tach de bai thanh cac doan tieng Viet / tieng Anh de nut "Nghe de bai" doc
 * moi doan bang dung giong. De co giao hay tron hai thu tieng ("Viết các từ:
 * apple, banana") — doc ca cau bang giong vi-VN thi tu tieng Anh phat am sai,
 * be hoc theo sai luon.
 *
 * Nhan dien khong can tu dien:
 *   - Co dau tieng Viet -> chac chan tieng Viet.
 *   - Co f/j/w/z -> chac chan khong phai tieng Viet (bang chu cai vi khong co).
 *   - Con lai: tu ASCII nao KHONG ghep duoc theo cau truc am tiet tieng Viet
 *     khong dau (phu am dau + nguyen am + phu am cuoi) thi la tieng Anh
 *     ("apple", "book", "unit"...). Tu ghep duoc ("trang", "ta", "cat"...) la
 *     mo ho, lay theo ngon ngu cua tu co nghia gan nhat — nho do "trang 5"
 *     trong cau Viet van doc giong Viet, con "cat" trong "apple, banana, cat"
 *     doc giong Anh.
 */

import type { Lang } from './types';

export interface SpeechSegment {
  text: string;
  lang: Lang;
}

const DAU_TIENG_VIET =
  /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;

/* Am tiet tieng Viet khong dau. Cum dai dat truoc cum ngan (ngh truoc ng truoc n) */
const AM_TIET_KHONG_DAU =
  /^(?:ngh|ng|nh|gh|gi|kh|ph|qu|th|tr|ch|b|c|d|g|h|k|l|m|n|p|r|s|t|v|x)?[aeiouy]{1,3}(?:ch|ng|nh|c|m|n|p|t)?$/i;

/** null = trung tinh (so, ky hieu, hoac tu ASCII trung cau truc am tiet Viet). */
function wordLang(word: string): Lang | null {
  if (DAU_TIENG_VIET.test(word)) return 'vi';
  if (!/[a-z]/i.test(word)) return null;
  if (/[fjwz]/i.test(word)) return 'en';
  return AM_TIET_KHONG_DAU.test(word) ? null : 'en';
}

/*
 * Web Speech API khong cho biet gioi tinh giong doc nen phai nhan dien theo TEN
 * — danh sach ten pho bien tren Apple (iOS/macOS), Microsoft (Edge/Windows) va
 * Google (Chrome/Android). Ten la thu ca hai doan vi/en phai thong nhat: de bai
 * ma nua cau giong co, nua cau giong chu thi tre nghe rat buon cuoi.
 */
const TEN_NU =
  /female|samantha|karen|moira|tessa|martha|kate|serena|stephanie|allison|ava|susan|nicky|joelle|zira|hazel|sonia|libby|aria|jenny|michelle|ana\b|linh|hoai\s?my/i;
const TEN_NAM =
  /\bmale|daniel|alex\b|fred|aaron|arthur|gordon|rishi|albert|oliver|david|mark\b|george|guy\b|ryan|thomas|james|nam\s?minh/i;

/** Nu +, nam − ; khong doan duoc ten thi coi nhu trung tinh (0). */
function diemGiongNu(name: string): number {
  // Kiem "nu" truoc vi chu "Female" chua chuoi con "male"
  if (TEN_NU.test(name)) return 4;
  if (TEN_NAM.test(name)) return -4;
  return 0;
}

/**
 * Chon giong doc, khong lay dai giong dau tien trong danh sach:
 *   - GIONG NU cho CA HAI thu tieng: ca de bai phai nghe nhu MOT co giao doc.
 *     Truoc day tieng Anh uu tien en-GB nen iPad hay roi vao Daniel (nam),
 *     trong khi tieng Viet la Linh (nu) — doi co/chu giua cau.
 *   - Vung mien chi la diem phu (en-GB hon en-US mot chut), thua diem gioi
 *     tinh: tha Samantha (My, nu) con hon Daniel (Anh, nam).
 * Cong them diem cho giong cai san tren may (localService): doc ngay khong cho
 * mang — nut nay tre bam lien tuc.
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: Lang
): SpeechSynthesisVoice | undefined {
  // Android co the tra "en_GB" dung gach duoi thay vi gach ngang
  const tag = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
  const score = (v: SpeechSynthesisVoice) => {
    let s = diemGiongNu(v.name);
    if (lang === 'en') {
      if (tag(v).startsWith('en-gb')) s += 2;
      else if (tag(v).startsWith('en-us')) s += 1;
    } else {
      if (tag(v).startsWith('vi-vn')) s += 2;
    }
    if (v.localService) s += 1;
    return s;
  };
  return voices
    .filter((v) => tag(v).startsWith(lang))
    .sort((a, b) => score(b) - score(a))[0];
}

export function splitSpeech(content: string, defaultLang: Lang): SpeechSegment[] {
  const tokens = content.split(/(\s+)/);
  const langs = tokens.map((t) =>
    /^\s*$/.test(t) ? null : wordLang(t.replace(/[^\p{L}]/gu, ''))
  );

  // Tu trung tinh lay ngon ngu cua tu ro nghia gan nhat phia truoc,
  // khong co thi lay phia sau, ca cau trung tinh thi ve defaultLang.
  const resolved: (Lang | null)[] = [];
  let prev: Lang | null = null;
  for (const l of langs) resolved.push(l ? (prev = l) : prev);
  let next: Lang | null = null;
  for (let i = resolved.length - 1; i >= 0; i--) {
    if (langs[i]) next = langs[i];
    else if (!resolved[i]) resolved[i] = next;
  }

  const segments: SpeechSegment[] = [];
  tokens.forEach((t, i) => {
    const lang = resolved[i] ?? defaultLang;
    const last = segments[segments.length - 1];
    if (last && (last.lang === lang || /^\s*$/.test(t))) last.text += t;
    else segments.push({ text: t, lang });
  });
  return segments.filter((s) => /\S/.test(s.text));
}
