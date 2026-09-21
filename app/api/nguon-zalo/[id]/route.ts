import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import {
  MAX_CHU_TEN_CO, MAX_CHU_TEN_NHOM, docMauNhanDien, getNguonZalo, lamSachCuaSo, updateNguonZalo,
} from '@/lib/nhanBaiZalo';
import { locChildIdsGiaoCho } from '@/lib/store';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/nguon-zalo/:id { tenNhom?, tenCo?, maNhom?, mauNhanDien?,
 *                             cuaSoDinhKemPhut?, dangBat?, childIds? } — CAN PIN.
 *
 * KHONG co DELETE, co y: mot nguon da nhan bai la cha cua nhung dong
 * `bai_tu_zalo` giu NGUYEN VAN tin cua co — ban sao duy nhat cua chung. Bo me
 * muon dung nhan bai thi TAT (`dangBat: false`), giong cong tac cua nhiem vu
 * hang ngay: nguon tat thi cua nhan tra 404 va zalo-agent khong con quet nhom
 * do nua, nhung lich su van con.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const { id } = await params;
  if (!(await getNguonZalo(familyId, id))) {
    return NextResponse.json({ error: T('Không tìm thấy nhóm Zalo này.') }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: T('Dữ liệu gửi lên không đọc được.') }, { status: 400 });

  const patch: Parameters<typeof updateNguonZalo>[2] = {};

  if (body.tenNhom !== undefined) {
    const v = String(body.tenNhom).trim().slice(0, MAX_CHU_TEN_NHOM);
    if (!v) return NextResponse.json({ error: T('Chưa nhập tên nhóm Zalo.') }, { status: 400 });
    patch.tenNhom = v;
  }
  if (body.tenCo !== undefined) {
    const v = String(body.tenCo).trim().slice(0, MAX_CHU_TEN_CO);
    if (!v) return NextResponse.json({ error: T('Chưa nhập tên cô giáo.') }, { status: 400 });
    patch.tenCo = v;
  }
  if (body.maNhom !== undefined) {
    patch.maNhom = String(body.maNhom).trim().slice(0, 120) || null;
  }
  if (body.mauNhanDien !== undefined) patch.mauNhanDien = docMauNhanDien(body.mauNhanDien);
  if (body.cuaSoDinhKemPhut !== undefined) {
    const v = lamSachCuaSo(body.cuaSoDinhKemPhut);
    if (v === null) {
      return NextResponse.json({ error: T('Cửa sổ nhận tệp phải từ 1 đến 1440 phút.') }, { status: 400 });
    }
    patch.cuaSoDinhKemPhut = v;
  }
  if (body.dangBat !== undefined) patch.dangBat = Boolean(body.dangBat);
  if (body.childIds !== undefined) {
    const giaoCho = await locChildIdsGiaoCho(familyId, body.childIds);
    if ('error' in giaoCho) return NextResponse.json({ error: T(giaoCho.error) }, { status: 400 });
    if (giaoCho.childIds === null) {
      return NextResponse.json({ error: T('Chọn ít nhất một con học lớp này.') }, { status: 400 });
    }
    patch.childIds = giaoCho.childIds;
  }

  return NextResponse.json({ nguon: await updateNguonZalo(familyId, id, patch) });
}
