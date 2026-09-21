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
  /**
   * Duong dan tep tren kho co duoc phep khong. KHONG truyen thi khong chan gi —
   * hai route cu (/api/upload-media, /api/nop-video) goi tu TRINH DUYET cua
   * nguoi da xac thuc va tu dat tien to trong lib/media.ts, nen chung giu nguyen
   * hanh vi. Cua cua zalo-agent thi can: `nguon_id` nam trong chinh duong dan,
   * nen khong chan o day la mot khoa hop le ghi duoc tep vao ho cua nguon khac.
   */
  kiemDuongDan?: (pathname: string) => boolean;
  /**
   * Chay ngay sau `auth`, va CHI o duong xin tep len — cap ve
   * (`blob.generate-client-token`) hoac multipart cua che do dev. KHONG chay o
   * su kien `blob.upload-completed`, vi su kien do khong mang tham so cua nguoi
   * goi va chan no la tep da nam tren kho ma khong bao gio "ha canh".
   *
   * Tra ve mot Response la DUNG NGAY voi chinh no; `null` la di tiep. Cua cua
   * zalo-agent dung cho cac phep kiem cua rieng no (nguon con nhan bai khong,
   * `ma_tin` da co chua) de chung o dung mot cho voi phep kiem khoa.
   */
  kiemTruocKhiNhan?: () => Promise<NextResponse | null>;
  /**
   * Ten truong mang ma loi trong than JSON, mac dinh `error`. Hai route cu tra
   * CAU DA DICH cho NGUOI doc va giao dien cua bo me/con doc dung truong do, nen
   * chung giu nguyen. Cua cua zalo-agent dat `loi` de ca ba cua
   * `/api/nhan-bai-zalo*` chi co MOT ten truong: may doc log duoc dung ma no
   * can nhat thay vi `undefined`.
   */
  tenTruongLoi?: string;
  loi: {
    chuaXacThuc: string;
    chuaBatBlobTrenVercel: string;
    thieuTep: string;
    saiLoai: string;
    quaNang: string;
    taiLoi: string;
    /** Chua bat Vercel Blob (che do cap ve). */
    chuaBatBlob: string;
    /** Body cap ve khong doc duoc. */
    duLieuHong: string;
    /** Duong dan khong qua `kiemDuongDan` (chi can khi co truyen hook do). */
    saiDuongDan?: string;
  };
}

export async function xuLyTaiTep(req: Request, cau: CauHinhTaiTep) {
  const ctype = req.headers.get('content-type') ?? '';
  const truong = cau.tenTruongLoi ?? 'error';
  const loiJson = (ma: string, status: number) =>
    NextResponse.json({ [truong]: ma }, { status });
  /** null = di tiep, Response = dung ngay. */
  const chan = async () => (cau.kiemTruocKhiNhan ? await cau.kiemTruocKhiNhan() : null);

  /* ---- Che do 2: dev chua co Blob, nhan tep truc tiep ---- */
  if (ctype.includes('multipart/form-data')) {
    if (!(await cau.auth())) return loiJson(cau.loi.chuaXacThuc, 401);
    const dung = await chan();
    if (dung) return dung;
    if (process.env.VERCEL) {
      // Tren Vercel ma roi vao nhanh nay nghia la chua bat Blob — dia serverless
      // khong giu tep qua request nen luu vao dau cung mat, bao thang con hon.
      return loiJson(cau.loi.chuaBatBlobTrenVercel, 501);
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) {
      return loiJson(cau.loi.thieuTep, 400);
    }
    const duoiMacDinh = cau.duoiMacDinh(file.type);
    if (!duoiMacDinh) {
      return loiJson(cau.loi.saiLoai, 400);
    }
    if (file.size > cau.maxBytes) {
      return loiJson(cau.loi.quaNang, 400);
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
    return loiJson(cau.loi.chuaBatBlob, 501);
  }

  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return loiJson(cau.loi.duLieuHong, 400);
  }

  // Chi buoc xac thuc VA cac phep kiem rieng cua route o buoc xin ve (goi tu
  // trinh duyet co cookie, hoac tu zalo-agent co khoa Bearer). Su kien
  // "upload-completed" do may chu cua Vercel Blob goi ve, khong co cookie va
  // khong co khoa — no ky bang `x-vercel-signature` va handleUpload tu kiem chu
  // ky do. Chan no o day la moi tep tai len deu bao loi cho ben tai.
  if (body.type === 'blob.generate-client-token') {
    if (!(await cau.auth())) return loiJson(cau.loi.chuaXacThuc, 401);
    const dung = await chan();
    if (dung) return dung;
  }

  try {
    const res = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => {
        // Nem chu khong tra loi: handleUpload bat va bien thanh 400 o duoi, va
        // quan trong hon la KHONG co ve nao duoc ky khi duong dan sai.
        if (cau.kiemDuongDan && !cau.kiemDuongDan(pathname)) {
          throw new Error(cau.loi.saiDuongDan ?? cau.loi.saiLoai);
        }
        return {
          allowedContentTypes: cau.allowedContentTypes,
          maximumSizeInBytes: cau.maxBytes,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // URL chi duoc ghi vao DB khi bo me bam Luu / con bam "Gửi bài" —
        // o thoi diem nay chua co gi de luu.
      },
    });
    return NextResponse.json(res);
  } catch (e) {
    return loiJson(e instanceof Error ? e.message : cau.loi.taiLoi, 400);
  }
}
