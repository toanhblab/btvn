import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import {
  CUA_SO_DINH_KEM_MAC_DINH, MAU_NHAN_DIEN_MAC_DINH, MAX_CHU_TEN_CO, MAX_CHU_TEN_NHOM,
  createNguonZalo, docMauNhanDien, lamSachCuaSo, listNguonZalo,
} from '@/lib/nhanBaiZalo';
import { locChildIdsGiaoCho } from '@/lib/store';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/** GET /api/nguon-zalo — cac nguon Zalo cua nha nay (ca nguon dang tat). CAN PIN. */
export async function GET() {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });
  return NextResponse.json({ nguon: await listNguonZalo(familyId) });
}

/**
 * POST /api/nguon-zalo { tenNhom, tenCo, maNhom?, mauNhanDien?, cuaSoDinhKemPhut?, childIds }
 * — them mot nhom Zalo. CAN PIN.
 *
 * `childIds` la BAT BUOC va khong duoc rong: mot nhom Zalo LA mot lop, nen
 * khong co trang thai "cả nhà" nhu nhiem vu hang ngay — nguon khong gan con nao
 * thi tin cua co vao se khong thanh bai cho ai. Dung `locChildIdsGiaoCho` de
 * dung mot cau bao loi voi man nhiem vu.
 */
export async function POST(req: Request) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const body = await req.json().catch(() => null);
  const tenNhom = String(body?.tenNhom ?? '').trim().slice(0, MAX_CHU_TEN_NHOM);
  if (!tenNhom) {
    return NextResponse.json({ error: T('Chưa nhập tên nhóm Zalo.') }, { status: 400 });
  }
  const tenCo = String(body?.tenCo ?? '').trim().slice(0, MAX_CHU_TEN_CO);
  if (!tenCo) {
    return NextResponse.json({ error: T('Chưa nhập tên cô giáo.') }, { status: 400 });
  }

  const cuaSo = body?.cuaSoDinhKemPhut === undefined
    ? CUA_SO_DINH_KEM_MAC_DINH
    : lamSachCuaSo(body.cuaSoDinhKemPhut);
  if (cuaSo === null) {
    return NextResponse.json({ error: T('Cửa sổ nhận tệp phải từ 1 đến 1440 phút.') }, { status: 400 });
  }

  const giaoCho = await locChildIdsGiaoCho(familyId, body?.childIds);
  if ('error' in giaoCho) return NextResponse.json({ error: T(giaoCho.error) }, { status: 400 });
  if (giaoCho.childIds === null) {
    return NextResponse.json({ error: T('Chọn ít nhất một con học lớp này.') }, { status: 400 });
  }

  const mau = body?.mauNhanDien === undefined
    ? MAU_NHAN_DIEN_MAC_DINH
    : docMauNhanDien(body.mauNhanDien);

  return NextResponse.json({
    nguon: await createNguonZalo(familyId, {
      tenNhom,
      tenCo,
      maNhom: String(body?.maNhom ?? '').trim().slice(0, 120) || null,
      mauNhanDien: mau,
      cuaSoDinhKemPhut: cuaSo,
      childIds: giaoCho.childIds,
    }),
  });
}
