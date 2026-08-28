import { NextResponse } from 'next/server';
import { parentFamilyId, viewingFamilyId } from '@/lib/auth';
import { laUrlTepAppCap } from '@/lib/media';
import { deleteAssignment, getAssignment, setStatus, submitVideo, updateAssignment } from '@/lib/store';
import { hwSourceOf, sanitizeDuration } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/assignments/:id
 *   { status?: 'done' | 'todo', videoUrl?: string }        -> con tick / nop video, KHONG can PIN
 *   { subject?, content?, note?, lang?, dueDate?, source?, media?,
 *     requiresVideo? }                                     -> bo me sua, CAN PIN
 *
 * Tach hai duong nhu vay vi tre khong dang nhap (PRD 4.5) nhung cung khong duoc
 * phep sua noi dung de bai. Duong cua con gio nhan them videoUrl — video con
 * quay de nop bai; thuong gui kem status:'done' vi nop video chinh la cach
 * hoan thanh bai co yeu cau quay.
 *
 * Ca hai duong deu phai thuoc dung nha: duong tick khong can PIN nhung van can
 * may da gan voi nha do, khong thi con nha nay tick duoc bai nha khac neu doan
 * ra id.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dữ liệu không đọc được.' }, { status: 400 });

  // Chi doi trang thai / nop video -> cho phep khong can PIN
  const keys = Object.keys(body);
  if (keys.length >= 1 && keys.every((k) => k === 'status' || k === 'videoUrl')) {
    const familyId = await viewingFamilyId();
    if (!familyId) {
      return NextResponse.json({ error: 'Máy này chưa gắn với nhà nào.' }, { status: 401 });
    }
    const current = await getAssignment(familyId, id);
    if (!current) {
      return NextResponse.json({ error: 'Không tìm thấy bài tập.' }, { status: 404 });
    }
    if ('status' in body && body.status !== 'done' && body.status !== 'todo') {
      return NextResponse.json({ error: 'Trạng thái không hợp lệ.' }, { status: 400 });
    }
    // Chi nhan URL do chinh app cap (Blob hoac /api/tep/<ten>) — duong nay khong
    // doi PIN nen chuoi tu do se cho phep ghi mot video KHONG TON TAI vao bai roi
    // bao bo me la con da nop.
    if ('videoUrl' in body && !laUrlTepAppCap(body.videoUrl)) {
      return NextResponse.json({ error: 'Video không hợp lệ.' }, { status: 400 });
    }
    // Bai bat buoc quay video thi tick suong khong tinh: phai co video (moi gui
    // kem, hoac da nop tu truoc) thi moi cho chuyen sang done.
    if (body.status === 'done' && current.requiresVideo &&
        !body.videoUrl && !current.submittedVideoUrl) {
      return NextResponse.json(
        { error: 'Bài này cần quay video trước khi xong nhé.' },
        { status: 400 }
      );
    }

    // Gui video kem status:'done' la mot viec duy nhat -> mot cau UPDATE duy nhat
    const nopVaXong = Boolean(body.videoUrl) && body.status === 'done';

    let assignment = current;
    if (body.videoUrl) {
      assignment = (await submitVideo(familyId, id, body.videoUrl, nopVaXong)) ?? assignment;
    }
    if ('status' in body && !nopVaXong) {
      assignment = (await setStatus(familyId, id, body.status === 'done')) ?? assignment;
    }
    return NextResponse.json({ assignment });
  }

  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });
  if (!(await getAssignment(familyId, id))) {
    return NextResponse.json({ error: 'Không tìm thấy bài tập.' }, { status: 404 });
  }

  // Noi giao chi nhan gia tri app biet — gia tri la ep ve truong tieu hoc
  if (body.source !== undefined) body.source = hwSourceOf(body.source);

  // Thoi luong bo me sua tay: chi can so duong hop ly, khong kep lai 5-15
  if (body.durationMinutes !== undefined) {
    body.durationMinutes = sanitizeDuration(body.durationMinutes);
  }

  if (body.requiresVideo !== undefined) body.requiresVideo = Boolean(body.requiresVideo);

  // Gui `media` len la thay CA danh sach tep dinh kem cua bai; lam sach truoc khi ghi
  if (body.media !== undefined) {
    body.media = (Array.isArray(body.media) ? body.media : [])
      .filter((m: { url?: unknown }) => typeof m?.url === 'string' && (m.url as string).length > 0)
      .map((m: { url: string; name?: unknown; kind?: unknown }) => ({
        url: m.url,
        name: typeof m.name === 'string' ? m.name : '',
        kind: m.kind === 'audio' || m.kind === 'image' ? m.kind : 'video',
      }));
  }
  return NextResponse.json({ assignment: await updateAssignment(familyId, id, body) });
}

/** DELETE /api/assignments/:id — chi bo me, chi bai cua nha minh. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: 'Cần mã PIN của bố mẹ.' }, { status: 401 });

  const { id } = await params;
  if (!(await getAssignment(familyId, id))) {
    return NextResponse.json({ error: 'Không tìm thấy bài tập.' }, { status: 404 });
  }
  await deleteAssignment(familyId, id);
  return NextResponse.json({ ok: true });
}
