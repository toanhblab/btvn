import { viewingFamilyId } from '@/lib/auth';
import { MAX_NOP_VIDEO_BYTES } from '@/lib/media';
import { xuLyTaiTep } from '@/lib/upload-route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/nop-video — video CON QUAY de nop bai. Than route dung chung voi
 * /api/upload-media (lib/upload-route: Blob khi co token, .data/uploads khi dev),
 * khac dung ba diem duoi day va vi the moi phai tach route rieng:
 *
 *   1. Xac thuc bang cookie THIET BI (viewingFamilyId) chu khong doi PIN — con
 *      khong dang nhap (PRD 4.5), iPad da gan vao nha la quay nop duoc.
 *   2. Chi nhan video. Con khong duoc muon duong nay de tai thu khac len.
 *   3. Tran rieng MAX_NOP_VIDEO_BYTES, cao hon tep bo me dinh kem (xem lib/media).
 *
 * Gioi han do dai nam o phia quay (MAX_QUAY_GIAY dung may quay sau 3 phut);
 * o day chi con tran dung luong lam chot cuoi.
 */
export async function POST(req: Request) {
  return xuLyTaiTep(req, {
    auth: async () => Boolean(await viewingFamilyId()),
    // MediaRecorder tra blob khong ten hoac ten khong duoi -> suy duoi tu MIME.
    // Chi can hai duoi nay: Safari ghi video/mp4, Chrome ghi video/webm.
    duoiMacDinh: (mime) =>
      mime.startsWith('video/') ? (mime.includes('webm') ? '.webm' : '.mp4') : null,
    maxBytes: MAX_NOP_VIDEO_BYTES,
    allowedContentTypes: ['video/*'],
    loi: {
      chuaXacThuc: 'Máy này chưa gắn với nhà nào.',
      chuaBatBlobTrenVercel:
        'Chưa bật Vercel Blob nên chưa nộp video được. Vào Storage trên Vercel tạo Blob store rồi deploy lại.',
      thieuTep: 'Chưa có video.',
      saiLoai: 'Chỉ nhận video thôi.',
      quaNang: 'Video hơi dài, con quay lại ngắn hơn nhé.',
      taiLoi: 'Tải video lỗi.',
    },
  });
}
