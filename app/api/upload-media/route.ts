import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { isParent } from '@/lib/auth';
import { MAX_MEDIA_BYTES, mediaKindOf } from '@/lib/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** Tep khong co duoi nhan ra duoc thi dat duoi mac dinh theo loai. */
const DUOI_MAC_DINH = { video: '.mp4', audio: '.m4a', image: '.jpg' } as const;

/**
 * POST /api/upload-media — tep dinh kem bai tap (video, ghi am, anh), hai che do
 * trong MOT route:
 *
 * 1. Body JSON (san pham cua `upload()` tu @vercel/blob/client): tep KHONG di
 *    qua server ma len thang Vercel Blob. Bat buoc phai the vi route serverless
 *    tren Vercel chi nhan body toi 4.5MB — anh thi lot, video/ghi am thi khong.
 *    Route nay chi cap "ve" cho trinh duyet tu tai len.
 *
 * 2. Body multipart (field "file"): duong lui khi dev chua bat Blob — ghi tep
 *    vao .data/uploads roi tra ve duong dan /api/tep/<ten>. KHONG dung data URL
 *    nhu anh de bai: video vai chuc MB ma nhet base64 vao sessionStorage/DB la vo.
 *
 * Ten tep ngau nhien, khong liet ke duoc tu ngoai — cung ly do voi
 * addRandomSuffix ben /api/upload (PRD muc 10).
 */
export async function POST(req: Request) {
  const ctype = req.headers.get('content-type') ?? '';

  /* ---- Che do 2: dev chua co Blob, nhan tep truc tiep ---- */
  if (ctype.includes('multipart/form-data')) {
    if (!(await isParent())) {
      return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });
    }
    if (process.env.VERCEL) {
      // Tren Vercel ma roi vao nhanh nay nghia la chua bat Blob — dia serverless
      // khong giu tep qua request nen luu vao dau cung mat, bao thang con hon.
      return NextResponse.json(
        { error: 'Chưa bật Vercel Blob nên chưa đính kèm tệp được. Vào Storage trên Vercel tạo Blob store rồi deploy lại.' },
        { status: 501 }
      );
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Chưa chọn tệp.' }, { status: 400 });
    }
    const kind = mediaKindOf(file.type);
    if (!kind) {
      return NextResponse.json({ error: 'Chỉ nhận video, ghi âm hoặc ảnh.' }, { status: 400 });
    }
    if (file.size > MAX_MEDIA_BYTES) {
      return NextResponse.json({ error: 'Tệp nặng quá 100MB, bố mẹ cắt ngắn bớt nhé.' }, { status: 400 });
    }

    const { mkdirSync, writeFileSync } = await import('node:fs');
    const { join, extname } = await import('node:path');
    const dir = './.data/uploads';
    mkdirSync(dir, { recursive: true });
    const duoi = /^\.[a-z0-9]{1,5}$/i.test(extname(file.name))
      ? extname(file.name).toLowerCase()
      : DUOI_MAC_DINH[kind];
    const ten = `${crypto.randomUUID().replace(/-/g, '')}${duoi}`;
    writeFileSync(join(dir, ten), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ url: `/api/tep/${ten}` });
  }

  /* ---- Che do 1: cap ve cho client upload len Vercel Blob ---- */
  if (!hasBlob) {
    return NextResponse.json({ error: 'Chưa bật Vercel Blob.' }, { status: 501 });
  }

  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return NextResponse.json({ error: 'Dữ liệu gửi lên không đọc được.' }, { status: 400 });
  }

  // Chi buoc PIN o buoc xin ve (goi tu trinh duyet, co cookie). Su kien
  // "upload-completed" do may chu cua Vercel Blob goi ve, khong co cookie —
  // handleUpload tu kiem chu ky cua no roi.
  if (body.type === 'blob.generate-client-token' && !(await isParent())) {
    return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });
  }

  try {
    const res = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['video/*', 'audio/*', 'image/*'],
        maximumSizeInBytes: MAX_MEDIA_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // URL tep chi nam trong ban nhap o sessionStorage cho den khi bo me
        // bam Luu — khong co gi de ghi vao DB o thoi diem nay.
      },
    });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Tải tệp lỗi.' },
      { status: 400 }
    );
  }
}
