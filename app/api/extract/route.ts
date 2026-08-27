import { NextResponse } from 'next/server';
import { isParent } from '@/lib/auth';
import { extractAssignments, hasAI, inferSource, splitByRule } from '@/lib/ai';

export const dynamic = 'force-dynamic';
// Doc anh bang AI co the lau; Vercel gioi han thoi gian chay ham serverless
// (PRD muc 8) nen dat tran ro rang thay vi de mac dinh.
export const maxDuration = 60;

/**
 * POST /api/extract  { text?, images?: [{ base64, mimeType }] }
 * -> { drafts, source: 'ai' | 'rule', hwSource, warning? }
 *
 * "source" la NGUON TACH (AI hay tach tho); "hwSource" la NOI GIAO doan tu noi
 * dung (lop tieng Anh / truong tieu hoc) — chi la goi y, bo me chon tay thi
 * lua chon do thang.
 *
 * Khong bao gio tra loi 500 tay khong: neu AI hong thi van tra ve ban tach tho
 * kem canh bao, de bo me sua tay chu khong bi ket (PRD muc 10).
 */
export async function POST(req: Request) {
  if (!(await isParent())) {
    return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const text: string = body?.text ?? '';
  const images = Array.isArray(body?.images) ? body.images : [];

  if (!text.trim() && images.length === 0) {
    return NextResponse.json({ error: 'Chưa có ảnh hoặc nội dung nào.' }, { status: 400 });
  }

  if (hasAI) {
    try {
      const drafts = await extractAssignments({ text, images });
      if (drafts.length > 0) {
        return NextResponse.json({ drafts, source: 'ai', hwSource: inferSource(drafts) });
      }
      return NextResponse.json({
        drafts: [],
        source: 'ai',
        hwSource: 'primary_school',
        warning: 'Không tìm thấy bài tập nào trong nội dung này. Bố mẹ thử nhập tay xem.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ro rang la loi cua AI -> lui ve tach tho, KHONG chan bo me lai
      const drafts = text.trim() ? splitByRule(text) : [];
      return NextResponse.json({
        drafts,
        source: 'rule',
        hwSource: inferSource(drafts),
        warning: `Chưa gọi được AI (${msg}). Đây là bản tách tạm — bố mẹ xem lại kỹ trước khi lưu.`,
      });
    }
  }

  const drafts = text.trim() ? splitByRule(text) : [];
  return NextResponse.json({
    drafts,
    source: 'rule',
    hwSource: inferSource(drafts),
    warning: text.trim()
      ? 'Chưa cài NOUS_API_KEY nên tách tạm theo dòng. Bố mẹ xem lại kỹ trước khi lưu.'
      : 'Chưa cài NOUS_API_KEY nên chưa đọc được chữ trong ảnh. Bố mẹ nhập tay giúp.',
  });
}
