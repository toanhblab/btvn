import { NextResponse } from 'next/server';
import { parentFamilyId } from '@/lib/auth';
import { boBaiZalo, duyetBaiZalo } from '@/lib/nhanBaiZalo';
import { chu } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/bai-zalo/:id { hanhDong: 'duyet' | 'bo' } — CAN PIN.
 *
 *   'duyet'  MOT CHAM cho ca muc: moi bai nhap cua tin nay thanh bai THAT va
 *            hien ngay tren man cua con.
 *   'bo'     "Không phải bài": xoa cac bai nhap, dong tin o lai o trang thai
 *            'bo' de lan quet sau cua zalo-agent van bi 409 chan (khong thi bo
 *            me phai bo lai cung mot tin moi 30 phut).
 *
 * MOT route cho ca hai vi chung la hai mat cua cung mot quyet dinh, va ca hai
 * deu ket thuc muc do — man duyet doi xu voi chung y het nhau (bam xong thi muc
 * bien mat). Ben trong, ca hai chot bang UPDATE co dieu kien `trang_thai =
 * 'nhap'` + RETURNING nen bo va me cung bam thi ben sau nhan 409, khong phai
 * mot lan duyet thu hai — cung khuon voi `duyetDoiThuong`.
 */
export async function POST(req: Request, { params }: Ctx) {
  const T = await chu();
  const familyId = await parentFamilyId();
  if (!familyId) return NextResponse.json({ error: T('Cần mã PIN của bố mẹ.') }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const hanhDong = body?.hanhDong;
  if (hanhDong !== 'duyet' && hanhDong !== 'bo') {
    return NextResponse.json({ error: T('Dữ liệu gửi lên không đọc được.') }, { status: 400 });
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
