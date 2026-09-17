/**
 * Tach bai tap tu anh chup (Zalo, vo, bang) hoac tu text bo me dan vao.
 *
 * Goi qua Nous Portal — API tuong thich OpenAI, nen chi la mot lan fetch, khong
 * can SDK rieng. Mac dinh dung qwen3-vl-32b-instruct: model thi giac-ngon ngu,
 * doc chu tieng Viet co dau trong anh chup tot hon han cac model 3B gia re.
 *
 * LUU Y khi doi model: phai chon model CO VISION. Hermes cua chinh Nous la
 * text->text, dat vao day se khong doc duoc anh — ma chup anh Zalo lai la duong
 * nhap chinh cua bo me (PRD muc 4.1).
 *
 * API key CHI o server (bien moi truong), khong bao gio xuong trinh duyet —
 * PRD muc 8 ghi ro dieu nay.
 */

import type { Book, DraftAssignment, HwSource, Lang } from './types';
import { clampDuration, DURATION_DEFAULT, iconFor, MAX_CHU_TEN_SACH, SUBJECTS } from './types';
import { T_VI, taoT, type Key, type T } from './i18n/chu';
import { NGON_NGU_MAC_DINH, type NgonNgu } from './i18n/ngonNgu';

/**
 * Ten mon AI tra ve la TIENG VIET (enum trong luoc do). Nha demo (issue #46) luu
 * ten mon theo ngon ngu cua nha nen dich nhan mon sau khi doc — CHI nhan mon;
 * de bai (content/note) giu nguyen ngon ngu goc, captain chot KHONG dich de bai
 * bang AI.
 */
const tenMonTheoNha = (subject: string, T: T): string =>
  subject in SUBJECTS ? T(subject as Key) : subject;

const BASE_URL = process.env.NOUS_BASE_URL || 'https://inference-api.nousresearch.com/v1';
const MODEL = process.env.NOUS_MODEL || 'qwen/qwen3-vl-32b-instruct';

export const hasAI = Boolean(process.env.NOUS_API_KEY);

const PROMPT = `Bạn đọc bài tập về nhà của học sinh tiểu học Việt Nam và tách thành danh sách bài riêng biệt.

Quy tắc:
- NGUYÊN TẮC TÁCH: tách theo CUỐN SÁCH / VỞ / PHIẾU / NGUỒN BÀI TẬP, KHÔNG tách theo
  dòng, theo trang hay theo số bài. Mọi việc con phải làm trong CÙNG MỘT cuốn — dù
  cô viết thành nhiều trang, nhiều số bài, nhiều dòng hay nhiều gạch đầu dòng — gộp
  thành MỘT bài; số trang / số bài ghi đủ vào "note" và nhắc gọn trong "content".
  Ví dụ: "Toán: làm trang 41, 42, 43 sách Poth Math" -> MỘT bài, content "Làm bài
  toán trang 41, 42, 43", note "Sách Poth Math — trang 41, 42, 43". KHÔNG tách
  thành ba bài theo ba trang.
  Hai cuốn khác nhau -> hai bài, kể cả cùng môn ("Toán: SGK trang 30; vở bài tập
  trang 12" -> hai bài). Không rõ cuốn nào nhưng cùng môn và cùng kiểu trang / số
  bài đứng liền nhau thì coi là cùng một cuốn.
  Việc không gắn với cuốn nào (quay video, vẽ tranh, tập thể dục, học thuộc bài
  hát...) -> mỗi việc một bài.
- "subject" phải chọn đúng một trong: ${Object.keys(SUBJECTS).join(', ')}.
- "content" là đề bài viết lại ngắn gọn, rõ ràng, dễ đọc to cho trẻ 4-6 tuổi nghe.
- "note" là thông tin phụ, ghi TÊN SÁCH/VỞ trước rồi mới đến số trang, số bài:
  "Sách Tiếng Việt tập 1 — trang 10", "Vở ô ly — bài 3 trang 34". Không thấy tên
  sách thì chỉ ghi trang/bài. Không có gì thì để chuỗi rỗng.
  Lý do: màn của con hiện dòng này ngay trên thẻ bài tập, để con lấy đúng quyển ra
  làm; tên sách nằm ở cuối chuỗi thì bị cắt mất.
- "lang" là ngôn ngữ của CHÍNH chuỗi "content" mà bạn viết ra.
- BẮT BUỘC: "content" và "lang" phải cùng ngôn ngữ.
  Đề tiếng Anh -> giữ nguyên tiếng Anh trong "content", lang = "en".
  TUYỆT ĐỐI không dịch đề tiếng Anh sang tiếng Việt.
  Đề tiếng Việt -> "content" tiếng Việt, lang = "vi".
  Lý do: app đọc "content" thành tiếng bằng giọng chọn theo "lang". Viết content
  tiếng Việt mà để lang = "en" thì máy đọc tiếng Việt bằng giọng Anh, trẻ 4 tuổi
  nghe không hiểu gì cả.
- KHÔNG tạo bài trùng nhau. Một mục tổng quát kèm các gạch đầu dòng chi tiết bên
  dưới, cùng một cuốn / phiếu, là MỘT bài: content ghi gọn đủ các ý chi tiết,
  không tạo thêm mục cho mục tổng quát.
  Ví dụ: "Hoàn thành Ex 1, Ex 2, Ex 3" + "Ex 1: viết nốt từ" + "Ex 2: nối các ngày"
  + "Ex 3: viết câu" -> MỘT bài, content "Ex 1 viết nốt từ, Ex 2 nối các ngày,
  Ex 3 viết câu".
  Lý do: con tick từng bài một; tách nhỏ theo trang hay theo số bài là con phải
  tick ba lần cho cùng một quyển, có mục tổng quát lẫn mục chi tiết là con tick hai
  lần cho cùng một việc.
- Giữ đủ MỌI việc con phải làm trong một mục, kể cả việc phụ như "quay video gửi
  cho cô", "viết vào vở riêng", "gửi vào nhóm". Bỏ sót thì con làm thiếu.
- "duration_minutes" là thời gian ước tính để trẻ làm xong TOÀN BỘ bài này sau
  khi đã gộp, SỐ NGUYÊN từ 5 đến 60 (phút). Ước theo độ phức tạp thực tế của
  TỪNG PHẦN: bài chép ngắn, tô màu một hình, đọc một trang → 5; bài trung bình →
  8-10; bài toán nhiều câu, viết đoạn văn, quay video gửi cô → 12-15.
  Gộp nhiều trang / nhiều số bài của cùng một cuốn thành một bài thì CỘNG ước
  lượng của từng phần lại, đừng lấy ước lượng của một phần.
  Ví dụ: "Làm bài toán trang 41, 42, 43 sách Poth Math" — mỗi trang ~8 phút ->
  duration_minutes = 24, KHÔNG phải 8 và cũng không phải 15.
  Không chắc thì để 10.
- "canQuayVideo" = true khi bài yêu cầu con QUAY VIDEO hoặc trình diễn thành
  tiếng/động tác để người khác kiểm tra: "quay video", "quay clip gửi cô",
  "đọc to", "đọc thuộc lòng", "kể lại câu chuyện cho bố mẹ nghe", "quay video
  kể lại", "thuyết trình", "hát", "tập thể dục", "biểu diễn"...
  Bài viết, vẽ, làm vào vở, hay chỉ XEM video cô gửi thì false.
  Đề đã ghi thẳng "quay video", "quay clip", "nộp video", "gửi video" thì
  canQuayVideo = true, không cần suy luận thêm — kể cả khi có chữ đệm ở giữa
  ("quay 1 video kể lại câu chuyện", "quay lại video bài hát").
  QUY TẮC ƯU TIÊN: đề có động từ chỉ việc viết / vẽ / làm vào vở thì LUÔN
  false, dù trong đề có chữ "kể lại".
  Ví dụ: "Viết đoạn văn kể lại câu chuyện Cây khế vào vở" -> canQuayVideo = false.
- Bỏ qua lời chào, lời dặn chung chung của cô giáo, không phải bài tập thì đừng đưa vào.
- Không bịa thêm bài không có trong nguồn.
- Chỉ trả về JSON đúng lược đồ, không kèm lời giải thích.`;

/**
 * Tran so cuon sach dua vao loi nhac. Mot con co chung muoi cuon; nha ba con khai
 * het cung chua toi ba muoi. Vuot tran (bo me khai tran lan, hay nhap trung) thi
 * chi lay nhung cuon dau danh sach — thu tu bo me them vao (listBooks) — chu
 * khong thoi phong loi nhac len theo so dong trong bang.
 */
export const MAX_SACH_TRONG_PROMPT = 30;

/**
 * Khoi ngu canh "sach cua nha" ghep SAU PROMPT (issue #64). Rong khi nha chua
 * khai cuon nao — luc do loi nhac Y NGUYEN nhu khi chua co tinh nang nay, chi
 * khac o luat gop theo sach da nam san trong PROMPT. Danh sach sach lam AI nhan
 * dung ten (viet tat, sai chinh ta) va doan dung mon; no KHONG phai dieu kien de
 * gop — "trang 41, 42, 43 sach Poth Math" van ra mot bai khi bang sach trong.
 *
 * Ten sach la chu bo me go: cat theo MAX_CHU_TEN_SACH (API da chan, day la chot
 * cuoi), ep ve mot dong de mot cai ten khong pha vo bo cuc danh sach.
 */
export function khoiSachChoAI(sach: Book[]): string {
  const dong = sach
    .slice(0, MAX_SACH_TRONG_PROMPT)
    .map((b) => {
      const ten = b.name.replace(/\s+/g, ' ').trim().slice(0, MAX_CHU_TEN_SACH);
      return ten ? `- ${ten}${b.subject ? ` (môn ${b.subject})` : ''}` : null;
    })
    .filter((d): d is string => d !== null);
  if (dong.length === 0) return '';
  return `SÁCH / VỞ / NGUỒN BÀI TẬP BỐ MẸ ĐÃ KHAI cho các con đang được giao bài:
${dong.join('\n')}
Dùng danh sách này để nhận ra tên sách trong nội dung kể cả khi cô viết tắt hay
viết sai chính tả, và để chọn "subject" theo sách khi đề không nói rõ môn. Ghi tên
sách đúng như trong danh sách vào "note". KHÔNG bịa bài từ danh sách này — chỉ tách
những gì có trong nội dung; nội dung nhắc tới cuốn không có trong danh sách thì vẫn
tách như thường.`;
}

/** Loi nhac he thong hoan chinh cho mot lan tach: luat chung + (neu co) sach cua nha. */
export function loiNhacHeThong(sach: Book[] = []): string {
  const khoi = khoiSachChoAI(sach);
  return khoi ? `${PROMPT}\n\n${khoi}` : PROMPT;
}

/**
 * Structured output kieu OpenAI bat buoc goc phai la object (khong duoc la
 * mang), nen boc danh sach trong khoa "baiTap".
 */
const SCHEMA = {
  type: 'object',
  properties: {
    baiTap: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          subject: { type: 'string', enum: Object.keys(SUBJECTS) },
          content: { type: 'string' },
          note: { type: 'string' },
          lang: { type: 'string', enum: ['vi', 'en'] },
          duration_minutes: { type: 'integer' },
          canQuayVideo: { type: 'boolean' },
        },
        // strict:true doi moi thuoc tinh deu phai nam trong required
        required: ['subject', 'content', 'note', 'lang', 'duration_minutes', 'canQuayVideo'],
        additionalProperties: false,
      },
    },
  },
  required: ['baiTap'],
  additionalProperties: false,
};

interface RawDraft {
  subject?: string; content?: string; note?: string; lang?: string;
  duration_minutes?: number;
  canQuayVideo?: boolean;
}

/**
 * Luoi THO nhan ra bai phai QUAY VIDEO. CHI dung cho splitByRule — ban tach tho
 * theo dong khi khong goi duoc AI, khong co cau tra loi nao de dua vao. Khi da
 * goi duoc AI thi truong canQuayVideo cua no la quyet dinh cuoi cung, KHONG OR
 * them regex nay vao: regex bat nham ("viết đoạn văn kể lại...") se chan con
 * tick xong bai. KHONG bat tu "video" tran: "xem video cô gửi" la XEM, khong
 * phai quay.
 *
 * DUNG "dong bo" danh sach nay voi danh sach trigger trong prompt cua AI o tren.
 * Hai ben CO Y lech nhau: prompt con co "kể lại ... cho bố mẹ nghe", "thuyết
 * trình", "hát" nhung o day khong co. Tieng Viet khong dong lai duoc bang mot
 * danh sach tu khoa — "kể lại" nam trong ca bai NOI ("kể lại cho bố mẹ nghe")
 * lan bai VIET ("viết đoạn văn kể lại ... vào vở"), va gan co sai vao bai viet
 * la XOA han nut "Đã làm xong" cua con cho tới khi bo me vao /bome bo tick.
 *
 * Nen o duong nay THIEU co la lua chon co chu y, khong phai lo: moi bai tach
 * theo dong deu mang confidence 0.3 nen man Kiem tra lai luon dan canh bao
 * "Tách tạm, chưa qua AI", va bo me bat chip 🎥 ngay tai do bang mot lan bam.
 * Bom them tu khoa vao day de "cho du" la doi cai gia dat hon cai duoc.
 *
 * Ngoai le duy nhat: khi co giao GHI THANG chu "video/clip/phim" sau mot dong tu
 * nop bai thi khong con gi phai doan, nen nhanh do nhan ca chu dem o giua ("quay
 * 1 video...", "quay lại video...", "nộp video...").
 *
 * Repo khong co unit test — cac ca duoi day la hop dong cua regex nay, doi regex
 * thi doi tay lai het:
 *   PHAI bat: "Quay 1 video kể lại câu chuyện" | "Quay một video thuyết trình"
 *             "Quay lại video bài hát" | "Quay 2 videos đọc bài"
 *             "Nộp video đọc bài" | "quay video gửi cô"
 *             "Đọc to bài thơ" | "Đọc thuộc lòng" | "Tập thể dục" | "Biểu diễn"
 *   KHONG duoc bat: "Viết đoạn văn kể lại câu chuyện Cây khế vào vở"
 *                   "Chép lời bài hát Bụi phấn vào vở"
 *                   "Xem video bài giảng rồi làm bài tập"
 *                   "Xem video cô gửi" | "Đọc toàn bộ câu chuyện" | "Đọc toán trang 5"
 *                   "Xem lại group video của lớp rồi viết vào vở"
 *                   "Bố mẹ backup video bài giảng cho con xem"
 *                   "Cô gửi video bài giảng, con xem rồi làm bài tập vào vở"
 *                   "Cô giáo gửi video cho bố mẹ tham khảo"
 *                   "Con xem ít nhất 1 tập phim hoạt hình trong link film cô gửi
 *                    trong nhóm riêng."
 *
 * Ba ca cuoi la ly do dong tu "gửi" DA BI BO khoi nhom dong tu — DUNG them lai.
 * Trong tin nhan cua co giao, "gửi" gan chu "video" thi nguoi gui thuong la CO
 * chu khong phai con ("cô gửi video bài giảng"), va ca hai huong va — neo nguoi
 * gui (cô|thầy) hay negative lookbehind chan chu ngu — deu vo tren bien the that
 * ("Cô giáo gửi", "Cô chủ nhiệm gửi", "Cô Lan gửi", "Giáo viên gửi", "Nhà trường
 * gửi"). Sot co thi bo me bat lai bang chip 🎥 khi duyet; bat oan thi XOA han nut
 * "Đã làm xong" cua con. Chieu "Con gửi video cho cô" van bat duoc qua "quay" /
 * "nộp" — hai chu gan nhu luon co mat trong de kieu do.
 *
 * Hai ca "group video" / "backup video" la ly do co (?<![a-zA-ZÀ-ỹ]) truoc nhom
 * dong tu: khong co bien trai thi "up" bat duoc phan duoi cua "gro-up" /
 * "back-up". splitByRule chi chay o may chu (app/api/extract) nen lookbehind
 * khong lien quan Safari cu.
 */
const VIDEO_HINT =
  /(?<![a-zA-ZÀ-ỹ])(quay|nộp|upload|up)\s*(lại\s*)?(\d+|một|hai|ba)?\s*(video|clip|phim)|đọc\s+to(?![a-zA-ZÀ-ỹ])|đọc\s+thuộc|thuộc\s+lòng|tập\s+thể\s+dục|biểu\s+diễn|read\s+aloud|recite|record\s+(a\s+)?video/i;

/**
 * Truoc day o day hoi model tu cham "confidence" 0..1, va man Kiem tra lai gan
 * co "AI khong chac" cho bai duoi 0.6. Do bang ANH THAT thi model tra ve 1 cho
 * TAT CA cac bai — ke ca bai no vua bo sot mot y — nen canh bao do khong bao gio
 * bat. Con so tu cham cua LLM khong dang tin, bo han cho khoi bay bo me.
 *
 * Gio confidence chi con y nghia "do tin cua NGUON": AI doc thi 1, tach tho theo
 * dong thi 0.3. Man Kiem tra lai canh bao dua vao nguon, khong dua vao tu danh
 * gia cua model.
 */
const DO_TIN_AI = 1;

/**
 * Chot chan cho truong "lang". Model doi khi dich de tieng Anh sang tieng Viet
 * roi van de lang = "en"; luc do man cua con doc chu tieng Viet bang giong Anh
 * va be 4 tuoi khong hieu gi (PRD muc 3).
 *
 * Chu tieng Anh khong bao gio co dau tieng Viet, nen chi can thay dau la biet
 * chac day la cau tieng Viet du model khai bao gi.
 */
const DAU_TIENG_VIET = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;

function langOf(content: string, declared?: string): Lang {
  if (declared === 'en' && DAU_TIENG_VIET.test(content)) return 'vi';
  return declared === 'en' ? 'en' : 'vi';
}

function normalize(items: RawDraft[], T: T): DraftAssignment[] {
  return items
    .filter((d) => d.content && d.content.trim())
    .map((d) => {
      const subject = d.subject && d.subject in SUBJECTS ? d.subject : 'Khác';
      const content = d.content!.trim();
      return {
        subject: tenMonTheoNha(subject, T),
        icon: iconFor(subject),
        content,
        note: d.note?.trim() || null,
        lang: langOf(content, d.lang),
        confidence: DO_TIN_AI,
        // Schema da rang 5-60 nhung van kep lai: model co the lo tra JSON ngoai schema
        durationMinutes: clampDuration(d.duration_minutes),
        requiresVideo: d.canQuayVideo === true,
      };
    });
}

/**
 * Model co the lo kem hang rao ```json du da yeu cau JSON thuan. Go rao va nhan
 * ca hai dang: { baiTap: [...] } hoac mang tran.
 */
function parseDrafts(raw: string): RawDraft[] {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed as RawDraft[];
  if (Array.isArray(parsed?.baiTap)) return parsed.baiTap as RawDraft[];
  throw new Error('JSON khong dung dang');
}

type Part =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/**
 * @param images  anh dang base64 (khong co tien to data:)
 * @param sach    sach cua nha cho nhom con dang duoc giao bai (listBooks) — ngu
 *                canh them vao loi nhac, xem khoiSachChoAI. Thieu / rong = loi
 *                nhac chuan.
 */
export async function extractAssignments(input: {
  text?: string;
  images?: { base64: string; mimeType: string }[];
  sach?: Book[];
}, ngonNgu: NgonNgu = NGON_NGU_MAC_DINH): Promise<DraftAssignment[]> {
  const T = taoT(ngonNgu);
  if (!hasAI) throw new Error('NO_API_KEY');

  const parts: Part[] = [];
  for (const img of input.images ?? []) {
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    });
  }
  if (input.text?.trim()) {
    parts.push({ type: 'text', text: `Nội dung bài tập:\n\n${input.text.trim()}` });
  }
  if (parts.length === 0) throw new Error('EMPTY_INPUT');

  // Route co maxDuration 60s; cat truoc mot nhip de con kip tra ban tach tho.
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NOUS_API_KEY!}`,
    },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,          // tach bai la viec doc chinh xac, khong phai sang tac
      messages: [
        { role: 'system', content: loiNhacHeThong(input.sach ?? []) },
        { role: 'user', content: parts },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'bai_tap', strict: true, schema: SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${body ? ` ${body.slice(0, 200)}` : ''}`);
  }

  const data = await res.json();
  const raw: string | undefined = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('EMPTY_RESPONSE');

  return normalize(parseDrafts(raw), T);
}

/**
 * Doan NOI GIAO tu ban tach: bai den tu lop hoc them tieng Anh hay truong tieu
 * hoc. Chi la goi y mac dinh — bo me chon tay thi lua chon do thang (man Them
 * bai tap / Kiem tra lai).
 *
 * Dau hieu: de bai tieng Anh nguyen van (lang = 'en') hoac mon "Tiếng Anh".
 * Qua nua so bai nhu vay thi ca dot gan nhu chac den tu lop tieng Anh — mot dot
 * nhap la MOT tin nhan cua MOT co giao nen ca dot chung mot nguon.
 *
 * CO Y chi tra ve HAI nguon du HW_SOURCES da co them 'other' (Khac): "Khac" la
 * lua chon cua CON NGUOI, khong de may doan. May doan ra "Khac" thi bo me khong
 * con biet bai do that su tu dau. Dung "sua" ham nay cho phu voi HW_SOURCES.
 */
export function inferSource(drafts: DraftAssignment[]): HwSource {
  // `subject` da la ten mon THEO NGON NGU cua nha (tenMonTheoNha) nen khong so
  // sanh voi chuoi tieng Viet duoc — icon la thu khong doi theo ngon ngu.
  const iconTiengAnh = SUBJECTS['Tiếng Anh'];
  const en = drafts.filter((d) => d.lang === 'en' || iconFor(d.subject) === iconTiengAnh).length;
  return en * 2 > drafts.length ? 'english_class' : 'primary_school';
}

/**
 * Dau hieu mot dong dang chi TRANG / SO BAI trong mot cuon: "trang 41", "tr. 5",
 * "bài 3", "page 12", "Ex 2", "Unit 3". Doi mot CHU SO ngay sau tu khoa, khong
 * thi "bài" khop moi dong ("làm bài tập", "bài thơ", "bài hát"). Chi dung cho
 * splitByRule (gop hai dong lien nhau cung mon, cung dang trang/bai).
 */
const DAU_HIEU_TRANG = /\b(?:trang|tr\.|page|p\.|bài|ex(?:ercise)?s?\.?|unit|lesson)\s*\d/i;

/**
 * Ep chu ve NFC — lam MOT LAN o cua vao, cho ca doan bo me dan lan ten sach.
 *
 * "ở" go trong trinh duyet la MOT ky tu (NFC), con chu dan tu Zalo / ban phim
 * tieng Viet tren macOS thuong la "o" + dau roi (NFD): nhin giong het nhau ma moi
 * phep so deu truot. Truot im lang o KHAP NOI trong splitByRule chu khong chi o
 * ten sach — bang tu khoa doan mon, DAU_TIENG_VIET (doan ngon ngu), VIDEO_HINT,
 * DAU_HIEU_TRANG deu la regex viet o dang NFC. Dang NFD lot vao thi moi the ra
 * mon "Khác", ngon ngu "en" (man cua con doc de tieng Viet bang giong Anh), sot
 * co quay video, va khong the nao gop duoc.
 */
const chuanHoaNFC = (s: string): string => s.normalize('NFC');

/** Bo dau, thuong hoa, gom khoang trang — de so ten sach bo me khai voi chu co go. */
const chuanHoa = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
    .replace(/\s+/g, ' ').trim();

/**
 * Tach thanh TU, giu song song ca dang co dau (chu thuong) lan dang bo dau.
 *
 * DOI chuoi da o dang NFC (xem chuanHoaNFC) — ca hai cho goi deu ep truoc. De
 * nguyen NFD thi dau roi KHONG phai \p{L} nen chinh phep tach tu cat giua chu
 * ("vở" ra hai tu "v" va "o"), va "===" o nhacTen tra false cho hai chuoi nhin
 * giong het nhau.
 */
const tachTu = (s: string): { co: string; khong: string }[] =>
  s.toLowerCase().split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean)
    .map((t) => ({ co: t, khong: chuanHoa(t) }));

/**
 * Dong nay co nhac ten cuon sach khong — so theo TU lien nhau, khong phai chuoi
 * con: "Vở ô ly" phai la ba tu dung canh nhau trong dong.
 *
 * Bo dau la de nhan ra chu co go khong dau ("tieng viet tap 1"), nhung bo dau roi
 * thi hai tu KHAC NHAU co the thanh mot: cuon "Toán" va chu "toàn" deu ra "toan",
 * nen chi so chuoi bo dau (ke ca co bien tu) thi dong "đọc toàn bộ câu chuyện" bi
 * gan nham cuon "Toán" — ma `note` chinh la dong con doc de lay dung quyen ra lam.
 * Vi the mot tu chi khop khi: dung nguyen dang co dau, HOAC chinh no khong co dau
 * nao (luc do khong con gi de phan biet, coi nhu co go tat). Bo sot mot cach nhac
 * long leo chi la khong gop duoc; gan nham cuon la con lay sai quyen.
 */
function nhacTen(tuDong: { co: string; khong: string }[], tuTen: { co: string; khong: string }[]): boolean {
  if (tuTen.length === 0) return false;
  for (let i = 0; i + tuTen.length <= tuDong.length; i++) {
    const khop = tuTen.every((t, j) => {
      const u = tuDong[i + j];
      return u.khong === t.khong && (u.co === t.co || u.co === u.khong);
    });
    if (khop) return true;
  }
  return false;
}

/**
 * Cuon sach (bo me da khai) duoc nhac trong dong nay — uu tien ten DAI nhat: bo me
 * khai ca "Toán" lan "Vở bài tập Toán" thi dong "Vở bài tập Toán trang 12" phai
 * ra cuon thu hai. Ten duoi 3 ky tu bo qua: khop bua.
 */
function sachTrongDong(line: string, sach: Book[]): Book | null {
  const tuDong = tachTu(line);
  const khop = sach
    .map((b) => ({ b, ten: chuanHoa(b.name), tu: tachTu(chuanHoaNFC(b.name)) }))
    .filter(({ ten, tu }) => ten.length >= 3 && nhacTen(tuDong, tu))
    .sort((x, y) => y.ten.length - x.ten.length);
  return khop[0]?.b ?? null;
}

/** Mot dong da doc xong, truoc khi gop — giu cac dau hieu de xet "cung cuon". */
interface DongTho {
  content: string;
  subject: string;       // khoa tieng Viet trong SUBJECTS
  book: Book | null;
  coTrang: boolean;
  lang: Lang;
  requiresVideo: boolean;
  /** Uoc luong phut cua RIENG phan nay — gop bao nhieu dong thi cong bay nhieu. */
  phut: number;
}

/**
 * Viec DOC LAP: doi con trinh dien (quay video, doc to, doc thuoc, the duc) ma
 * khong chi vao trang / so bai nao. PROMPT cua AI de moi viec nhu vay ra MOT bai
 * rieng ("Việc không gắn với cuốn nào -> mỗi việc một bài"), nen duong lui cung
 * khong duoc nuot no vao bai cua cuon sach dung canh: gop vao la the bai doi
 * quay video, con mat luon nut "Đã làm xong" cho ca phan viet.
 */
const viecDocLap = (d: DongTho): boolean => d.requiresVideo && !d.coTrang;

/**
 * Mon cua hai dong khong CHOI nhau. "Khác" o day nghia la CHUA DOAN RA mon, khong
 * phai "mon khac" — dong "Vở ô ly trang 4" khong lo mon nao ca. Mot ben chua doan
 * ra thi khong co gi mau thuan; hai ben doan ra hai mon khac nhau moi la choi.
 */
const monKhongChoi = (a: DongTho, b: DongTho): boolean =>
  a.subject === b.subject || a.subject === 'Khác' || b.subject === 'Khác';

/** Mon DA DOAN RA cua bai gop: ben nao biet thi lay ben do, dong "Khác" khong nuot mon dung. */
const monDaBiet = (a: DongTho, b: DongTho): string => (a.subject === 'Khác' ? b.subject : a.subject);

/**
 * Hai dong lien nhau co phai CUNG MOT CUON khong — ban tho cua nguyen tac "mot
 * cuon sach = mot bai" (issue #64) khi khong goi duoc AI.
 *
 * BANG DIEU KIEN GOP — moi dong phai thoa HET dieu kien cua nhanh cua no; thieu
 * mot dieu kien la KHONG gop. Bang nay la tat ca nhung gi ham nay hua, khong hua
 * gi rong hon; moi dong co mot bai kiem hanh vi trong lib/tach-theo-sach.test.ts.
 *
 *   Nhanh CO TEN SACH — ca hai dong nhac toi cuon bo me da khai:
 *     1. cung MOT cuon (so theo id, khong phai theo ten);
 *     2. mon KHONG CHOI nhau (monKhongChoi): bang nhau, HOAC mot ben la "Khác".
 *        Cung mot quyen vo KHONG co nghia la cung mot mon — "Vở ô ly: chép bài
 *        toán trang 3" va "Vở ô ly: viết chính tả trang 4" la hai the (Toán /
 *        Tiếng Việt), khong duoc thanh mot the Toán. Nhung "Khác" la CHUA DOAN RA
 *        mon chu khong phai mon khac: "Vở ô ly trang 4" khong lo mon nao ca, nen
 *        no gop vao dong cung cuon va bai gop mang mon DA BIET (monDaBiet), du
 *        dong "Khác" dung truoc hay dung sau;
 *     3. khong ben nao la VIEC DOC LAP (viecDocLap: doi quay / doc to ma khong chi
 *        trang nao).
 *   Bang chung "cung mot cuon da khai" manh hon nhanh duoi, nhung no bo qua DUNG
 *   MOT thu: NGON NGU doan duoc. "Poth Math tr. 44" khong co dau nao nen bi doan
 *   la tieng Anh, con "Toán trang 45 sách Poth Math" la tieng Viet — ro rang mot
 *   cuon. Khong bo qua mon, khong bo qua viec doc lap. Nhanh nay KHONG doi dau
 *   hieu trang: ten cuon da la moc roi.
 *
 *   Nhanh KHONG TEN SACH — khong dong nao nhac cuon nao:
 *     1. cung MON, va mon do khac "Khác" (khong doan ra mon thi khong con bang
 *        chung nao);
 *     2. ca hai deu chi TRANG / SO BAI (DAU_HIEU_TRANG);
 *     3. cung NGON NGU doan duoc.
 *   Dieu kien 2 lam viec doc lap khong bao gio gop duoc o nhanh nay (viecDocLap
 *   doi khong co dau hieu trang), nen luat "viec doc lap giu bai rieng" dung o ca
 *   hai nhanh.
 *
 *   MOT dong nhac ten sach, dong kia khong -> khong gop: khong biet dong kia thuoc
 *   cuon nao.
 *
 * Co quay video KHONG phai dieu kien chan gop: cung mot cuon ma mot dong doi "đọc
 * to" giua cac trang thi ca bai gop phai quay — dung nhu AI lam ("giu du MOI viec
 * trong mot muc, ke ca quay video").
 *
 * GIOI HAN co y, ghi ca o README: khong co AI thi khong biet hai dong "Toán trang
 * 30" va "Toán trang 12" la mot cuon hay hai cuon (SGK / vo bai tap) neu co khong
 * ghi ten — o day coi la MOT, vi captain phan nan chieu tach vun (#64) va man
 * Kiem tra lai da co nut "Tách bài này" cho chieu nguoc lai.
 */
function cungCuon(a: DongTho, b: DongTho): boolean {
  if (a.book || b.book) {
    if (a.book?.id !== b.book?.id) return false;
    return monKhongChoi(a, b) && !viecDocLap(a) && !viecDocLap(b);
  }
  return a.subject === b.subject && a.subject !== 'Khác' && a.coTrang && b.coTrang && a.lang === b.lang;
}

/**
 * Gop dong `b` vao `a`: noi de bai; giu mon DA DOAN RA cua mot trong hai (icon
 * tinh theo mon do luc xuat ra); CONG uoc luong cua hai phan (ba trang gop lam
 * mot the thi the do phai duoc ba lan thoi gian, khong phai mot — uoc luong may
 * sinh ra deu di theo tran cua clampDuration, xem lib/types.ts, va sai theo huong
 * THUA con hon thieu); mot trong hai phai quay video thi bai gop phai quay; co
 * dong tieng Viet thi doc giong Viet.
 */
function gopDong(a: DongTho, b: DongTho): DongTho {
  return {
    ...a,
    content: `${a.content}; ${b.content}`,
    subject: monDaBiet(a, b),
    phut: a.phut + b.phut,
    requiresVideo: a.requiresVideo || b.requiresVideo,
    lang: a.lang === 'vi' || b.lang === 'vi' ? 'vi' : 'en',
  };
}

/**
 * Duong lui khi khong co API key / het quota / mang loi (PRD muc 10 yeu cau
 * van phai nhap duoc bai). Tach tho theo dong, doan mon theo tu khoa, roi GOP
 * cac dong lien nhau thuoc cung mot cuon (cungCuon) — cung nguyen tac "mot cuon
 * sach = mot bai" voi PROMPT cua AI, o muc khong co AI lam duoc. Giao dien phai
 * bao ro cho bo me biet day khong phai ket qua cua AI.
 *
 * @param sach  sach cua nha (listBooks) — nhan ten sach trong dong de gop va de
 *              lay mon; rong thi chi con luat "cung mon + cung dang trang/bai".
 */
export function splitByRule(text: string, T: T = T_VI, sach: Book[] = []): DraftAssignment[] {
  const HINTS: [RegExp, string][] = [
    [/\btoán|phép tính|cộng|trừ|nhân|chia\b/i, 'Toán'],
    [/\btiếng việt|tập đọc|chính tả|tập viết\b/i, 'Tiếng Việt'],
    [/\btiếng anh|english|unit \d|vocabulary\b/i, 'Tiếng Anh'],
    [/\bvẽ|tô màu|mĩ thuật|mỹ thuật\b/i, 'Vẽ'],
    [/\btự nhiên|khoa học|quan sát\b/i, 'Tự nhiên'],
  ];

  const dong: DongTho[] = chuanHoaNFC(text)
    .split(/\r?\n|(?:^|\s)[-•*]\s+/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .map((line) => {
      const book = sachTrongDong(line, sach);
      // Mon: theo tu khoa trong dong; dong khong lo mon ma nhac mot cuon bo me da
      // khai mon thi lay mon cua cuon do.
      const subject = HINTS.find(([re]) => re.test(line))?.[1] ?? book?.subject ?? 'Khác';
      // Chi coi la tieng Anh khi khong co dau tieng Viet nao. Dung DAU_TIENG_VIET
      // (bang day du) — bang cu thieu cac chu co HAI dau (ế, ố, ứ...) nen "Tiếng
      // Anh trang 6" bi coi la tieng Anh, va lang lech thi luat "cung cuon" o
      // duoi khong bao gio gop duoc hai dong tieng Viet cung mon.
      const viChars = (line.match(new RegExp(DAU_TIENG_VIET.source, 'gi')) ?? []).length;
      return {
        content: line,
        subject,
        book,
        coTrang: DAU_HIEU_TRANG.test(line),
        lang: (viChars === 0 && /[a-z]/i.test(line) ? 'en' : 'vi') as Lang,
        requiresVideo: VIDEO_HINT.test(line),
        // Tach tho khong doan duoc do phuc tap cua tung dong -> moi dong mot muc
        // mac dinh; gop bao nhieu dong thi bai gop cong bay nhieu.
        phut: DURATION_DEFAULT,
      };
    });

  const gop = dong.reduce<DongTho[]>((acc, d) => {
    const truoc = acc[acc.length - 1];
    if (truoc && cungCuon(truoc, d)) {
      acc[acc.length - 1] = gopDong(truoc, d);
      return acc;
    }
    return [...acc, d];
  }, []);

  return gop.map((d) => ({
    subject: tenMonTheoNha(d.subject, T),
    icon: iconFor(d.subject),
    content: d.content,
    // Ten sach len the bai cua con (nhu AI ghi vao note) khi nhan ra cuon nao
    note: d.book?.name ?? null,
    lang: d.lang,
    confidence: 0.3,   // thap de man kiem tra luon canh bao bo me xem lai
    // Bo me sua lai o man kiem tra; tran van la tran cua AI (clampDuration)
    durationMinutes: clampDuration(d.phut),
    requiresVideo: d.requiresVideo,
  }));
}
