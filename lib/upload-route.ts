/**
 * Than chung cua cac route nhan tep tai len (/api/upload-media, /api/nop-video).
 *
 * Hai route phai TACH RIENG vi khac nhau ba diem — xac thuc (PIN bo me vs cookie
 * thiet bi cua con), loai tep nhan, va tran dung luong — nhung phan con lai (chon
 * che do theo content-type, chot 501 khi tren Vercel ma chua bat Blob, dat ten
 * tep khi ghi vao .data/uploads, cap ve cho client upload) thi y het nhau.
 *
 * Gop vao day vi ten tep local `<32 hex><duoi>` la mot HOP DONG voi hai ben doc
 * no — GET /api/tep va laUrlTepAppCap trong lib/media.ts. De hai route tu dat ten
 * thi doi hop dong phai sua hai cho va rat de sot mot cho.
 */

import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { duongDanTep } from './media';

const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export interface CauHinhTaiTep {
  /** Ai duoc tai len: isParent() cho tep bo me, viewingFamilyId() cho video con. */
  auth: () => Promise<boolean>;
  /**
   * MIME -> duoi mac dinh khi ten tep khong co duoi nhan ra duoc; tra null la
   * KHONG nhan loai nay (route tra loi loi.saiLoai).
   */
  duoiMacDinh: (mime: string) => string | null;
  maxBytes: number;
  /** Loai tep Vercel Blob duoc phep nhan khi cap ve cho client. */
  allowedContentTypes: string[];
  loi: {
    chuaXacThuc: string;
    chuaBatBlobTrenVercel: string;
    thieuTep: string;
    saiLoai: string;
    quaNang: string;
    taiLoi: string;
  };
}

export async function xuLyTaiTep(req: Request, cau: CauHinhTaiTep) {
  const ctype = req.headers.get('content-type') ?? '';

  /* ---- Che do 2: dev chua co Blob, nhan tep truc tiep ---- */
  if (ctype.includes('multipart/form-data')) {
    if (!(await cau.auth())) {
      return NextResponse.json({ error: cau.loi.chuaXacThuc }, { status: 401 });
    }
    if (process.env.VERCEL) {
      // Tren Vercel ma roi vao nhanh nay nghia la chua bat Blob — dia serverless
      // khong giu tep qua request nen luu vao dau cung mat, bao thang con hon.
      return NextResponse.json({ error: cau.loi.chuaBatBlobTrenVercel }, { status: 501 });
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: cau.loi.thieuTep }, { status: 400 });
    }
    const duoiMacDinh = cau.duoiMacDinh(file.type);
    if (!duoiMacDinh) {
      return NextResponse.json({ error: cau.loi.saiLoai }, { status: 400 });
    }
    if (file.size > cau.maxBytes) {
      return NextResponse.json({ error: cau.loi.quaNang }, { status: 400 });
    }

    const { mkdirSync, writeFileSync } = await import('node:fs');
    const { join, extname } = await import('node:path');
    const dir = './.data/uploads';
    mkdirSync(dir, { recursive: true });
    const duoi = /^\.[a-z0-9]{1,5}$/i.test(extname(file.name))
      ? extname(file.name).toLowerCase()
      : duoiMacDinh;
    // Ten ngau nhien, khong liet ke duoc tu ngoai — cung ly do voi addRandomSuffix
    // ben /api/upload (PRD muc 10).
    const ten = `${crypto.randomUUID().replace(/-/g, '')}${duoi}`;
    writeFileSync(join(dir, ten), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ url: duongDanTep(ten) });
  }

  /* ---- Che do 1: cap ve cho client upload len Vercel Blob ---- */
  if (!hasBlob) {
    return NextResponse.json({ error: 'Chưa bật Vercel Blob.' }, { status: 501 });
  }

  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return NextResponse.json({ error: 'Dữ liệu gửi lên không đọc được.' }, { status: 400 });
  }

  // Chi buoc xac thuc o buoc xin ve (goi tu trinh duyet, co cookie). Su kien
  // "upload-completed" do may chu cua Vercel Blob goi ve, khong co cookie —
  // handleUpload tu kiem chu ky cua no roi.
  if (body.type === 'blob.generate-client-token' && !(await cau.auth())) {
    return NextResponse.json({ error: cau.loi.chuaXacThuc }, { status: 401 });
  }

  try {
    const res = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: cau.allowedContentTypes,
        maximumSizeInBytes: cau.maxBytes,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // URL chi duoc ghi vao DB khi bo me bam Luu / con bam "Gửi bài" —
        // o thoi diem nay chua co gi de luu.
      },
    });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : cau.loi.taiLoi },
      { status: 400 }
    );
  }
}
