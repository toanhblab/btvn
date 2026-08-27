import { isParent } from '@/lib/auth';
import { MAX_MEDIA_BYTES, mediaKindOf } from '@/lib/media';
import { xuLyTaiTep } from '@/lib/upload-route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Tep khong co duoi nhan ra duoc thi dat duoi mac dinh theo loai. */
const DUOI_MAC_DINH = { video: '.mp4', audio: '.m4a', image: '.jpg' } as const;

/**
 * POST /api/upload-media — tep dinh kem bai tap (video, ghi am, anh). Than route
 * nam o lib/upload-route va dung chung voi /api/nop-video; o do co hai che do:
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
 * Rieng route nay: doi PIN bo me, nhan ca ba loai tep, tran MAX_MEDIA_BYTES.
 */
export async function POST(req: Request) {
  return xuLyTaiTep(req, {
    auth: isParent,
    duoiMacDinh: (mime) => {
      const kind = mediaKindOf(mime);
      return kind ? DUOI_MAC_DINH[kind] : null;
    },
    maxBytes: MAX_MEDIA_BYTES,
    allowedContentTypes: ['video/*', 'audio/*', 'image/*'],
    loi: {
      chuaXacThuc: 'Cần mã PIN của bố mẹ.',
      chuaBatBlobTrenVercel:
        'Chưa bật Vercel Blob nên chưa đính kèm tệp được. Vào Storage trên Vercel tạo Blob store rồi deploy lại.',
      thieuTep: 'Chưa chọn tệp.',
      saiLoai: 'Chỉ nhận video, ghi âm hoặc ảnh.',
      quaNang: 'Tệp nặng quá 100MB, bố mẹ cắt ngắn bớt nhé.',
      taiLoi: 'Tải tệp lỗi.',
    },
  });
}
