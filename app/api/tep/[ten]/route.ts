import { NextResponse } from 'next/server';
import { TEN_TEP_RE } from '@/lib/media';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tep/<ten> — tra ve tep dinh kem (video, ghi am, anh) da luu vao
 * .data/uploads khi dev chua bat Vercel Blob (xem /api/upload-media). Tren
 * production moi tep deu nam tren Blob nen route nay khong bao gio duoc goi.
 *
 * Khong doi dang nhap: man cua con khong co PIN (PRD 4.5), giong nhu anh tren
 * Blob thi bao ve bang ten tep ngau nhien khong doan duoc.
 */

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.3gp': 'video/3gpp',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.amr': 'audio/amr',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
};

export async function GET(req: Request, { params }: { params: Promise<{ ten: string }> }) {
  const { ten } = await params;

  // Ten hop le duy nhat la <32 hex><duoi> do lib/upload-route tu dat (TEN_TEP_RE
  // la hop dong dung chung) — vua la chot chong ".." lach ra ngoai thu muc, vua
  // chan liet ke mo.
  const m = TEN_TEP_RE.exec(ten);
  if (!m) return NextResponse.json({ error: 'Không có tệp này.' }, { status: 404 });

  const { readFileSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const duongDan = join('./.data/uploads', ten);
  if (!existsSync(duongDan)) {
    return NextResponse.json({ error: 'Không có tệp này.' }, { status: 404 });
  }

  const buf = readFileSync(duongDan);
  const headers: Record<string, string> = {
    'Content-Type': MIME[m[2]] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    // Ten ngau nhien nen noi dung khong bao gio doi -> cache thoai mai
    'Cache-Control': 'private, max-age=31536000, immutable',
  };

  // Safari CHI phat video khi server tra loi duoc Range (206) — thieu doan nay
  // thi tren iPad bam play cu quay tron mai.
  const range = req.headers.get('range');
  const rm = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (rm && (rm[1] || rm[2])) {
    const start = rm[1] ? Number(rm[1]) : Math.max(0, buf.length - Number(rm[2]));
    const end = rm[1] && rm[2] ? Math.min(Number(rm[2]), buf.length - 1) : buf.length - 1;
    if (start > end || start >= buf.length) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${buf.length}` },
      });
    }
    return new Response(new Uint8Array(buf.subarray(start, end + 1)), {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${buf.length}`,
        'Content-Length': String(end - start + 1),
      },
    });
  }

  return new Response(new Uint8Array(buf), {
    headers: { ...headers, 'Content-Length': String(buf.length) },
  });
}
