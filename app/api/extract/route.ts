import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { extractAssignments, hasAI, inferSource, splitByRule } from '@/lib/ai';
import { listBooks } from '@/lib/store';
import { HW_SOURCE_DEFAULT, type Book } from '@/lib/types';
import { chu, ngonNguHienTai } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';
// Doc anh bang AI co the lau; Vercel gioi han thoi gian chay ham serverless
// (PRD muc 8) nen dat tran ro rang thay vi de mac dinh.
export const maxDuration = 60;

/**
 * POST /api/extract  { text?, images?: [{ base64, mimeType }], childIds?: string[] }
 * -> { drafts, source: 'ai' | 'rule', hwSource, warning? }
 *
 * "source" la NGUON TACH (AI hay tach tho); "hwSource" la NOI GIAO doan tu noi
 * dung (mot ma trong HW_SOURCES) — chi la goi y, bo me chon tay thi
 * lua chon do thang.
 *
 * "childIds" la nhom con bo me dang giao bai: dung de lay DUNG danh sach sach cua
 * nhom do (listBooks, issue #64) lam ngu canh cho AI va cho ban tach tho. Thieu
 * thi lay sach ca nha. Sach chi la goi y — nha chua khai cuon nao thi hai duong
 * tach van chay y nhu cu, van gop theo sach.
 *
 * Khong bao gio tra loi 500 tay khong: neu AI hong thi van tra ve ban tach tho
 * kem canh bao, de bo me sua tay chu khong bi ket (PRD muc 10).
 */
export async function POST(req: Request) {
  const T = await chu();
  const ngonNgu = await ngonNguHienTai();
  // Cung mot hang rao voi isParent(): co phien bo me moi di tiep; can ca id nha
  // de lay sach cua DUNG nha nay.
  const familyId = await parentFamilyId();
  if (!familyId) {
    return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const text: string = body?.text ?? '';
  const images = Array.isArray(body?.images) ? body.images : [];
  const childIds: string[] = Array.isArray(body?.childIds) ? body.childIds.map(String) : [];

  if (!text.trim() && images.length === 0) {
    return NextResponse.json({ error: T('Chưa có ảnh hoặc nội dung nào.') }, { status: 400 });
  }

  // Sach la ngu canh "co thi tot": bang chua co (SKIP_MIGRATIONS=1) hay DB truc
  // trac cung khong duoc chan bo me tach bai — coi nhu nha chua khai cuon nao.
  let sach: Book[] = [];
  try {
    sach = await listBooks(familyId, { childIds });
  } catch (err) {
    console.error('Khong doc duoc sach cua nha khi tach bai', familyId, err);
  }

  if (hasAI) {
    try {
      const drafts = await extractAssignments({ text, images, sach }, ngonNgu);
      if (drafts.length > 0) {
        return NextResponse.json({ drafts, source: 'ai', hwSource: inferSource(drafts) });
      }
      return NextResponse.json({
        drafts: [],
        source: 'ai',
        hwSource: HW_SOURCE_DEFAULT,
        warning: T('Không tìm thấy bài tập nào trong nội dung này. Bố mẹ thử nhập tay xem.'),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ro rang la loi cua AI -> lui ve tach tho, KHONG chan bo me lai
      const drafts = text.trim() ? splitByRule(text, T, sach) : [];
      return NextResponse.json({
        drafts,
        source: 'rule',
        hwSource: inferSource(drafts),
        warning: T('Chưa gọi được AI ({msg}). Đây là bản tách tạm — bố mẹ xem lại kỹ trước khi lưu.', { msg }),
      });
    }
  }

  const drafts = text.trim() ? splitByRule(text, T, sach) : [];
  return NextResponse.json({
    drafts,
    source: 'rule',
    hwSource: inferSource(drafts),
    warning: text.trim()
      ? T('Chưa cài NOUS_API_KEY nên tách tạm theo dòng. Bố mẹ xem lại kỹ trước khi lưu.')
      : T('Chưa cài NOUS_API_KEY nên chưa đọc được chữ trong ảnh. Bố mẹ nhập tay giúp.'),
  });
}
