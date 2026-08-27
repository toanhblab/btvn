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

import type { DraftAssignment, HwSource, Lang } from './types';
import { clampDuration, DURATION_DEFAULT, iconFor, SUBJECTS } from './types';

const BASE_URL = process.env.NOUS_BASE_URL || 'https://inference-api.nousresearch.com/v1';
const MODEL = process.env.NOUS_MODEL || 'qwen/qwen3-vl-32b-instruct';

export const hasAI = Boolean(process.env.NOUS_API_KEY);

const PROMPT = `Bạn đọc bài tập về nhà của học sinh tiểu học Việt Nam và tách thành danh sách bài riêng biệt.

Quy tắc:
- Mỗi bài tập là một mục riêng. Một dòng "Toán: bài 1, bài 2 trang 30" là MỘT bài.
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
- KHÔNG tạo bài trùng nhau. Nếu một mục tổng quát đã được liệt kê chi tiết ở các
  gạch đầu dòng bên dưới nó, chỉ giữ các mục chi tiết, bỏ mục tổng quát đi.
  Ví dụ: "Hoàn thành Ex 1, Ex 2, Ex 3" + "Ex 1: viết nốt từ" + "Ex 2: nối các ngày"
  + "Ex 3: viết câu" -> chỉ giữ ba mục Ex 1, Ex 2, Ex 3.
  Lý do: con tick từng bài một, có mục tổng quát thì con phải tick hai lần cho
  cùng một việc.
- Giữ đủ MỌI việc con phải làm trong một mục, kể cả việc phụ như "quay video gửi
  cho cô", "viết vào vở riêng", "gửi vào nhóm". Bỏ sót thì con làm thiếu.
- "duration_minutes" là thời gian ước tính để trẻ làm xong bài, SỐ NGUYÊN từ 5
  đến 15 (phút). Ước theo độ phức tạp thực tế: bài chép ngắn, tô màu một hình,
  đọc một trang → 5; bài trung bình → 8-10; bài toán nhiều câu, viết đoạn văn,
  quay video gửi cô → 12-15. Không chắc thì để 10.
- Bỏ qua lời chào, lời dặn chung chung của cô giáo, không phải bài tập thì đừng đưa vào.
- Không bịa thêm bài không có trong nguồn.
- Chỉ trả về JSON đúng lược đồ, không kèm lời giải thích.`;

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
          duration_minutes: { type: 'integer', minimum: 5, maximum: 15 },
        },
        // strict:true doi moi thuoc tinh deu phai nam trong required
        required: ['subject', 'content', 'note', 'lang', 'duration_minutes'],
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
}

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

function normalize(items: RawDraft[]): DraftAssignment[] {
  return items
    .filter((d) => d.content && d.content.trim())
    .map((d) => {
      const subject = d.subject && SUBJECTS[d.subject] ? d.subject : 'Khác';
      const content = d.content!.trim();
      return {
        subject,
        icon: iconFor(subject),
        content,
        note: d.note?.trim() || null,
        lang: langOf(content, d.lang),
        confidence: DO_TIN_AI,
        // Schema da rang 5-15 nhung van kep lai: model co the lo tra JSON ngoai schema
        durationMinutes: clampDuration(d.duration_minutes),
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
 */
export async function extractAssignments(input: {
  text?: string;
  images?: { base64: string; mimeType: string }[];
}): Promise<DraftAssignment[]> {
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
        { role: 'system', content: PROMPT },
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

  return normalize(parseDrafts(raw));
}

/**
 * Doan NOI GIAO tu ban tach: bai den tu lop hoc them tieng Anh hay truong tieu
 * hoc. Chi la goi y mac dinh — bo me chon tay thi lua chon do thang (man Them
 * bai tap / Kiem tra lai).
 *
 * Dau hieu: de bai tieng Anh nguyen van (lang = 'en') hoac mon "Tiếng Anh".
 * Qua nua so bai nhu vay thi ca dot gan nhu chac den tu lop tieng Anh — mot dot
 * nhap la MOT tin nhan cua MOT co giao nen ca dot chung mot nguon.
 */
export function inferSource(drafts: DraftAssignment[]): HwSource {
  const en = drafts.filter((d) => d.lang === 'en' || d.subject === 'Tiếng Anh').length;
  return en * 2 > drafts.length ? 'english_class' : 'primary_school';
}

/**
 * Duong lui khi khong co API key / het quota / mang loi (PRD muc 10 yeu cau
 * van phai nhap duoc bai). Tach tho theo dong va doan mon theo tu khoa —
 * giao dien phai bao ro cho bo me biet day khong phai ket qua cua AI.
 */
export function splitByRule(text: string): DraftAssignment[] {
  const HINTS: [RegExp, string][] = [
    [/\btoán|phép tính|cộng|trừ|nhân|chia\b/i, 'Toán'],
    [/\btiếng việt|tập đọc|chính tả|tập viết\b/i, 'Tiếng Việt'],
    [/\btiếng anh|english|unit \d|vocabulary\b/i, 'Tiếng Anh'],
    [/\bvẽ|tô màu|mĩ thuật|mỹ thuật\b/i, 'Vẽ'],
    [/\btự nhiên|khoa học|quan sát\b/i, 'Tự nhiên'],
  ];

  return text
    .split(/\r?\n|(?:^|\s)[-•*]\s+/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .map((line) => {
      const subject = HINTS.find(([re]) => re.test(line))?.[1] ?? 'Khác';
      // Chi coi la tieng Anh khi gan nhu khong co dau tieng Viet
      const viChars = (line.match(/[àáảãạăâđêôơưèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/gi) ?? []).length;
      return {
        subject,
        icon: iconFor(subject),
        content: line,
        note: null,
        lang: (viChars === 0 && /[a-z]/i.test(line) ? 'en' : 'vi') as Lang,
        confidence: 0.3,   // thap de man kiem tra luon canh bao bo me xem lai
        // Tach tho khong doan duoc do phuc tap -> de mac dinh, bo me sua o man kiem tra
        durationMinutes: DURATION_DEFAULT,
      };
    });
}
