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
