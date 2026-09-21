import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { boBaiZalo, duyetBaiZalo, tachLaiBaiZalo } from '@/lib/nhanBaiZalo';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/bai-zalo/:id { hanhDong: 'duyet' | 'bo' | 'tach-lai' } — CAN PIN.
 *
 *   'duyet'     MOT CHAM cho ca muc: moi bai nhap cua tin nay thanh bai THAT va
 *               hien ngay tren man cua con.
 *   'bo'        "Không phải bài": xoa cac bai nhap, dong tin o lai o trang thai
 *               'bo' de lan quet sau cua zalo-agent van bi 409 chan (khong thi
 *               bo me phai bo lai cung mot tin moi 30 phut).
 *   'tach-lai'  Chay lai buoc tach bai khi no hong giua chung. KHONG ket thuc
 *               muc: muc o lai voi bo bai nhap moi.
 *
 * MOT route cho ca ba vi chung cung mot tai nguyen va cung mot lop xac thuc.
 * Day la duong cua NGUOI — chuoi loi qua `T(...)`, khac ba cua
 * `/api/nhan-bai-zalo*` danh cho may. 'duyet' va 'bo' chot bang UPDATE co dieu
 * kien `trang_thai = 'nhap'` + RETURNING nen bo va me cung bam thi ben sau nhan
 * 409, khong phai mot lan duyet thu hai — cung khuon voi `duyetDoiThuong`.
 */
export async function POST(req: Request, { params }: Ctx) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const hanhDong = body?.hanhDong;
  if (hanhDong !== 'duyet' && hanhDong !== 'bo' && hanhDong !== 'tach-lai') {
    return NextResponse.json({ error: T('Dữ liệu gửi lên không đọc được.') }, { status: 400 });
  }

  if (hanhDong === 'tach-lai') {
    const kq = await tachLaiBaiZalo(familyId, id);
    if (kq.ok) return NextResponse.json({ ok: true, soBai: kq.soBai, baiNhap: kq.baiNhap });
    if (kq.loi === 'khong-thay') {
      return NextResponse.json({ error: T('Không tìm thấy tin này.') }, { status: 404 });
    }
    if (kq.loi === 'da-xu-ly') {
      return NextResponse.json({ error: T('Tin này đã được xử lý rồi.') }, { status: 409 });
    }
    return NextResponse.json(
      { error: T('Tách lại chưa được. Thử lại sau nhé.') }, { status: 503 });
  }

  const kq = hanhDong === 'duyet'
    ? await duyetBaiZalo(familyId, id)
    : await boBaiZalo(familyId, id);

  if (!kq.ok) {
    return kq.loi === 'khong-thay'
      ? NextResponse.json({ error: T('Không tìm thấy tin này.') }, { status: 404 })
      : NextResponse.json({ error: T('Tin này đã được xử lý rồi.') }, { status: 409 });
  }
  return NextResponse.json({ ok: true, soBai: kq.soBai });
}
