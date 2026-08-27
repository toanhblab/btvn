/**
 * Upload tep dinh kem bai tap (video, ghi am, anh) — phan chay o TRINH DUYET.
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
 */
export async function uploadSubmissionVideo(
  file: File,
  blobEnabled: boolean
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
