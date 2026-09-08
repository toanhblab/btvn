import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import {
  deleteChore, getChore, listChores, locChildIdsGiaoCho, moveChore, updateChore,
} from '@/lib/store';
import {
  ICON_NHIEM_VU_MAC_DINH, MAX_CHU_VIEC_NHA, lamSachIcon, lamSachSao, nhomNhiemVuOf,
} from '@/lib/types';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/viec-nha/:id — sua mot nhiem vu hang ngay. CAN PIN.
 *
 *   { content }        doi chu
 *   { icon }           doi icon (mot emoji)
 *   { stars }          doi so sao (1..10)
 *   { nhom }           'after_study' | 'housework'
 *   { childIds }       null = ca nha; mang id con (khong rong, thuoc nha nay)
 *   { enabled }        bat / tat (tat thi ngung tao dong moi, tick cu van con)
 *   { move: 'len' | 'xuong' }  doi cho voi nhiem vu ngay tren / ngay duoi
 *
 * Moi thay doi CHI anh huong dong tao SAU do (tru nhom — doc live, xem
 * lib/store.ts). getChore loc theo nha nen nhiem vu cua nha khac tra 404.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: T('Dữ liệu không đọc được.') }, { status: 400 });

  if (!(await getChore(familyId, id))) {
    return NextResponse.json({ error: T('Không tìm thấy việc này.') }, { status: 404 });
  }

  if (body.move !== undefined) {
    if (body.move !== 'len' && body.move !== 'xuong') {
      return NextResponse.json({ error: T('Hướng di chuyển không hợp lệ.') }, { status: 400 });
    }
    await moveChore(familyId, id, body.move === 'len' ? -1 : 1);
    return NextResponse.json({ chores: await listChores(familyId) });
  }

  const patch: Parameters<typeof updateChore>[2] = {};

  if (body.content !== undefined) {
    const content = String(body.content).trim();
    if (!content) return NextResponse.json({ error: T('Chưa nhập việc gì.') }, { status: 400 });
    if (content.length > MAX_CHU_VIEC_NHA) {
      return NextResponse.json({ error: T('Việc dài quá, để ngắn thôi cho con đọc được.') }, { status: 400 });
    }
    patch.content = content;
  }
  if (body.icon !== undefined) patch.icon = lamSachIcon(body.icon, ICON_NHIEM_VU_MAC_DINH);
  if (body.stars !== undefined) {
    const stars = lamSachSao(body.stars);
    if (stars === null) return NextResponse.json({ error: T('Số sao phải từ 1 đến 10.') }, { status: 400 });
    patch.stars = stars;
  }
  if (body.nhom !== undefined) patch.nhom = nhomNhiemVuOf(body.nhom);
  if ('childIds' in body) {
    const giaoCho = await locChildIdsGiaoCho(familyId, body.childIds);
    if ('error' in giaoCho) return NextResponse.json({ error: T(giaoCho.error) }, { status: 400 });
    patch.childIds = giaoCho.childIds;
  }
  if (body.enabled !== undefined) patch.enabled = body.enabled === true;

  return NextResponse.json({ chore: await updateChore(familyId, id, patch) });
}

/**
 * DELETE /api/viec-nha/:id — BO han mot nhiem vu. CAN PIN.
 *
 * Danh dau da bo chu khong xoa dong that (deleteChore): nhiem vu bien mat khoi
 * man cai dat, khong khoi phuc duoc, va khong duoc tao cho nhung ngay sau nua —
 * nhung nhung ngay DA TAO thi giu nguyen, ke ca nhung lan con da tick va sao da
 * cong. Khong khoi phuc duoc nen giao dien van phai hoi lai truoc khi goi.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const { id } = await params;
  if (!(await getChore(familyId, id))) {
    return NextResponse.json({ error: T('Không tìm thấy việc này.') }, { status: 404 });
  }

  await deleteChore(familyId, id);
  return NextResponse.json({ ok: true });
}
