import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { createChore, listChores, locChildIdsGiaoCho } from '@/lib/store';
import {
  ICON_NHIEM_VU_MAC_DINH, MAX_CHU_VIEC_NHA, SAO_NHIEM_VU_MAC_DINH, lamSachIcon, lamSachSao,
  nhomNhiemVuOf,
} from '@/lib/types';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/viec-nha — danh sach nhiem vu hang ngay CUA NHA NAY (ca nhiem vu dang
 * tat). CAN PIN.
 *
 * Man cua con khong goi duong nay nen khong can mot duong doc khong PIN o day:
 * tu issue #36 no khong doc daily_chores nua ma doc CAC DONG assignments da tao
 * cho tung ngay (listAssignments, includeChores: true).
 */
export async function GET() {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  return NextResponse.json({ chores: await listChores(familyId) });
}

/**
 * POST /api/viec-nha { content, icon?, stars?, nhom?, childIds? } — them mot
 * nhiem vu vao cuoi danh sach. CAN PIN.
 *
 *   icon      mot emoji, thieu -> 🧹
 *   stars     1..MAX_SAO_NHIEM_VU, thieu -> 1
 *   nhom      'after_study' | 'housework', thieu/la -> 'after_study'
 *   childIds  null/thieu = ca nha; mang id con (khong rong, thuoc nha nay)
 */
export async function POST(req: Request) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const body = await req.json().catch(() => null);
  const content = String(body?.content ?? '').trim();
  if (!content) return NextResponse.json({ error: T('Chưa nhập việc gì.') }, { status: 400 });
  if (content.length > MAX_CHU_VIEC_NHA) {
    return NextResponse.json({ error: T('Việc dài quá, để ngắn thôi cho con đọc được.') }, { status: 400 });
  }

  const stars = body?.stars === undefined ? SAO_NHIEM_VU_MAC_DINH : lamSachSao(body.stars);
  if (stars === null) {
    return NextResponse.json({ error: T('Số sao phải từ 1 đến 10.') }, { status: 400 });
  }

  const giaoCho = await locChildIdsGiaoCho(familyId, body?.childIds);
  if ('error' in giaoCho) return NextResponse.json({ error: T(giaoCho.error) }, { status: 400 });

  return NextResponse.json({
    chore: await createChore(familyId, {
      content,
      icon: lamSachIcon(body?.icon, ICON_NHIEM_VU_MAC_DINH),
      stars,
      nhom: nhomNhiemVuOf(body?.nhom),
      childIds: giaoCho.childIds,
    }),
  });
}
