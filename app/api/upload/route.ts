import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { isParent } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/**
 * POST /api/upload  (multipart, field "file")
 * -> { url }
 *
 * Anh chup Zalo cua lop co the chua ten va thong tin hoc sinh khac (PRD muc 10)
 * nen dat `addRandomSuffix` de duong dan khong the doan va khong liet ke duoc
 * tu ben ngoai.
 *
 * Chua bat Vercel Blob thi tra ve data URL de luong nhap bai van chay duoc khi
 * dev. Data URL nang, chi dung tam khi phat trien.
 */
export async function POST(req: Request) {
  if (!(await isParent())) {
    return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Chưa chọn ảnh.' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Chỉ nhận tệp ảnh.' }, { status: 400 });
  }

  if (hasBlob) {
    const blob = await put(`bai-tap/${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });
    return NextResponse.json({ url: blob.url });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  return NextResponse.json({
    url: `data:${file.type};base64,${base64}`,
    warning: 'Chưa bật Vercel Blob nên ảnh đang nhúng trực tiếp, chỉ nên dùng khi thử.',
  });
}
