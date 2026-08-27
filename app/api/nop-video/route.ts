import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { viewingFamilyId } from '@/lib/auth';
import { MAX_NOP_VIDEO_BYTES } from '@/lib/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/**
 * POST /api/nop-video — video CON QUAY de nop bai. Cau truc hai che do y het
 * /api/upload-media (Blob khi co token, .data/uploads khi dev — xem giai thich
 * o do), khac hai diem va vi the moi phai tach route rieng:
 *
 *   1. Xac thuc bang cookie THIET BI (viewingFamilyId) chu khong doi PIN — con
 *      khong dang nhap (PRD 4.5), iPad da gan vao nha la quay nop duoc.
 *   2. Chi nhan video. Con khong duoc muon duong nay de tai thu khac len.
 *
 * Gioi han do dai nam o phia quay (MAX_QUAY_GIAY dung may quay sau 3 phut);
 * o day chi con tran dung luong lam chot cuoi.
 */
export async function POST(req: Request) {
  const ctype = req.headers.get('content-type') ?? '';

  /* ---- Che do 2: dev chua co Blob, nhan tep truc tiep ---- */
  if (ctype.includes('multipart/form-data')) {
    if (!(await viewingFamilyId())) {
      return NextResponse.json({ error: 'Máy này chưa gắn với nhà nào.' }, { status: 401 });
    }
    if (process.env.VERCEL) {
      return NextResponse.json(
        { error: 'Chưa bật Vercel Blob nên chưa nộp video được. Vào Storage trên Vercel tạo Blob store rồi deploy lại.' },
        { status: 501 }
      );
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Chưa có video.' }, { status: 400 });
    }
    if (!file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Chỉ nhận video thôi.' }, { status: 400 });
    }
    if (file.size > MAX_NOP_VIDEO_BYTES) {
      return NextResponse.json({ error: 'Video hơi dài, con quay lại ngắn hơn nhé.' }, { status: 400 });
    }

    const { mkdirSync, writeFileSync } = await import('node:fs');
    const { join, extname } = await import('node:path');
    const dir = './.data/uploads';
    mkdirSync(dir, { recursive: true });
    // MediaRecorder tra blob khong ten hoac ten khong duoi -> suy duoi tu MIME.
    // Chi can hai duoi nay: Safari ghi video/mp4, Chrome ghi video/webm.
    const duoi = /^\.[a-z0-9]{1,5}$/i.test(extname(file.name))
      ? extname(file.name).toLowerCase()
      : file.type.includes('webm') ? '.webm' : '.mp4';
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

  // Chi buoc cookie thiet bi o buoc xin ve (goi tu trinh duyet). Su kien
  // "upload-completed" do may chu Vercel Blob goi ve, khong co cookie —
  // handleUpload tu kiem chu ky cua no roi (giong /api/upload-media).
  if (body.type === 'blob.generate-client-token' && !(await viewingFamilyId())) {
    return NextResponse.json({ error: 'Máy này chưa gắn với nhà nào.' }, { status: 401 });
  }

  try {
    const res = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['video/*'],
        maximumSizeInBytes: MAX_NOP_VIDEO_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // URL chi duoc ghi vao DB khi con bam "Gửi bài" (PATCH videoUrl) —
        // o thoi diem nay chua co gi de luu.
      },
    });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Tải video lỗi.' },
      { status: 400 }
    );
  }
}
