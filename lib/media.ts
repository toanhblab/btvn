/**
 * Tep dinh kem bai tap (video, ghi am, anh): ham upload chay o TRINH DUYET, cong
 * voi cac hang so + hop dong ten/URL ma CA HAI phia dung chung.
 *
 * Module DUNG CHUNG client + server, khong phai module chi cua trinh duyet:
 * QuayVideo/SuaBai/NhapTay/KiemTraLai nap no trong bundle trinh duyet, con
 * /api/upload-media, /api/nop-video, /api/tep, /api/assignments/:id va
 * lib/upload-route nap no o may chu. Nen moi thu o day phai ISOMORPHIC — them
 * code cham `window` / `navigator` / `document` o TOP LEVEL la no vo ngay khi
 * route handler nap module, chu khong phai loi tren trinh duyet. Can do capability
 * cua thiet bi thi do BEN TRONG ham (nhu uploadSubmissionVideo) hoac dat o
 * component.
 *
 * Tep dinh kem khong duoc di qua route serverless nhu anh de bai (/api/upload)
 * vi Vercel chan body o 4.5MB — video/ghi am cua co giao vuot ngay. Thay vao do:
 *   - Co Vercel Blob  -> upload() tu trinh duyet len thang Blob, /api/upload-media
 *                        chi cap ve (handleUpload).
 *   - Chua co (dev)   -> POST multipart vao /api/upload-media, server ghi tep vao
 *                        .data/uploads va tra ve /api/tep/<ten>.
 *
 * Component biet dang o che do nao qua prop `blobEnabled` do server component
 * truyen xuong (doc process.env.BLOB_READ_WRITE_TOKEN — trinh duyet khong tu
 * biet duoc bien moi truong cua server).
 */

import { upload } from '@vercel/blob/client';
import type { AttachedMedia, MediaKind } from './types';

/** Video luyen phat am co giao gui qua Zalo thuong vai chuc MB, chan o 100MB. */
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

/** Icon Material Symbols cho tung loai — dung chung o moi cho hien tep dinh kem. */
export const MEDIA_ICON: Record<MediaKind, string> = {
  video: 'smart_display',
  audio: 'music_note',
  image: 'image',
};

/** Tep dau vao cho <input type="file"> o cac cho dinh kem. */
export const MEDIA_ACCEPT = 'video/*,audio/*,image/*';

/**
 * Ten tep hop le duy nhat trong .data/uploads: <32 hex><duoi>, do lib/upload-route
 * tu dat. Vua la chot chong ".." lach ra ngoai thu muc, vua chan liet ke mo.
 */
export const TEN_TEP_RE = /^([0-9a-f]{32})(\.[a-z0-9]{1,5})$/;

const TEP_PREFIX = '/api/tep/';

/** Duong dan app tra ve cho tep ghi o .data/uploads (che do dev chua bat Blob). */
export function duongDanTep(ten: string): string {
  return `${TEP_PREFIX}${ten}`;
}

/**
 * URL tep nay co PHAI do app minh cap khong? Chi hai dang: duong dan
 * /api/tep/<32 hex><duoi> (che do dev) hoac https tren host Vercel Blob.
 *
 * Can thiet vi duong PATCH cua con KHONG doi PIN (chi doi cookie thiet bi, ma
 * cookie do phat cho bat cu ai mo link /nha/<slug>). Khong chot dang URL thi
 * chuoi bat ky cung ghi duoc vao submitted_video_url: bo me thay chip "🎥 Đã nộp
 * video" cho video khong ton tai, va trinh duyet bo me tai mot URL ngoai la.
 */
export function laUrlTepAppCap(url: unknown): url is string {
  if (typeof url !== 'string' || !url || url.length > 2048) return false;
  if (url.startsWith(TEP_PREFIX)) return TEN_TEP_RE.test(url.slice(TEP_PREFIX.length));
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return u.protocol === 'https:' && /(^|\.)blob\.vercel-storage\.com$/.test(u.hostname);
}

/** Phan loai theo MIME; khong phai video/audio/anh thi tra null de bao loi som. */
export function mediaKindOf(mime: string): MediaKind | null {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  return null;
}

/**
 * Gioi han video CON QUAY de nop bai: 3 phut la du doc thuoc long mot bai tho
 * dai, va o muc bitrate ta dat (~1.5Mbps hinh + tieng) thi 3 phut ≈ 35MB —
 * nam xa duoi tran MAX_NOP_VIDEO_BYTES, mang nha yeu cung tai noi.
 */
export const MAX_QUAY_GIAY = 180;

/**
 * Tran RIENG cho video con nop, cao hon tep bo me dinh kem. Duong lui tren iPad
 * la app Camera cua he dieu hanh, no ghi 1080p30 H.264 ≈ 60MB/phut (so cua
 * Apple), nen 3 phut can ~180MB — dung MAX_MEDIA_BYTES 100MB thi con quay hon
 * 1 phut rui la khong nop duoc nua. 250MB de con du dat cho MAX_QUAY_GIAY.
 */
export const MAX_NOP_VIDEO_BYTES = 250 * 1024 * 1024;

/**
 * Tai video con quay len kho — cung co che voi tep bo me dinh kem (Blob khi co,
 * .data/uploads khi dev) nhung qua route /api/nop-video RIENG: route do xac thuc
 * bang cookie thiet bi (con khong co PIN) va chi nhan video.
 *
 * onProgress: ban camera iPad co the ~180MB, tren mang nha la vai phut man hinh
 * nhu treo — con tuong may hong roi thoat giua duong. CHI duong Blob bao duoc
 * tien do that; duong dev-multipart khong goi callback lan nao (fetch khong co
 * tien do upload), va o day KHONG bao gio bia so phan tram.
 */
export async function uploadSubmissionVideo(
  file: File,
  blobEnabled: boolean,
  onProgress?: (phanTram: number) => void
): Promise<string> {
  if (!file.type.startsWith('video/')) throw new Error('Tệp này không phải video.');
  if (file.size > MAX_NOP_VIDEO_BYTES) {
    throw new Error('Video hơi dài, con quay lại ngắn hơn nhé.');
  }

  if (blobEnabled) {
    const blob = await upload(`nop-bai/${file.name}`, file, {
      access: 'public',
      handleUploadUrl: '/api/nop-video',
      multipart: true,
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
    });
    return blob.url;
  }

  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/nop-video', { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Tải video lỗi.');
  return data.url as string;
}

export async function uploadMediaFile(file: File, blobEnabled: boolean): Promise<AttachedMedia> {
  const kind = mediaKindOf(file.type);
  if (!kind) throw new Error(`"${file.name}" không phải video, ghi âm hay ảnh.`);
  if (file.size > MAX_MEDIA_BYTES) {
    throw new Error(`"${file.name}" nặng quá 100MB, bố mẹ cắt ngắn bớt nhé.`);
  }

  if (blobEnabled) {
    const blob = await upload(`dinh-kem/${file.name}`, file, {
      access: 'public',
      handleUploadUrl: '/api/upload-media',
      // Tep lon chia phan tai song song, phan nao loi tu thu lai
      multipart: true,
    });
    return { url: blob.url, name: file.name, kind };
  }

  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload-media', { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Tải tệp lỗi.');
  return { url: data.url as string, name: file.name, kind };
}
