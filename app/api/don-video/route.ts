import { NextResponse } from 'next/server';
import { MAX_MOI_LUOT_MAC_DINH, donVideoQuaHan, tranNguoiDat } from '@/lib/donVideo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/don-video — don video con nop qua han. CRON GOI, KHONG PHAI NGUOI.
 *
 * Lich o vercel.json: `0 19 * * *` (UTC) ≈ 2 gio sang gio Viet Nam, luc khong ai
 * dung app. Goi Hobby chi cho MOT lan/ngay va sai so toi 59 phut — dung bang
 * nhip can, khong cham toi han che nao.
 *
 * Xac thuc bang CRON_SECRET: Vercel tu gui `Authorization: Bearer <CRON_SECRET>`.
 * KHONG dinh gi toi PIN cua bo me hay cookie thiet bi — day khong phai duong cua
 * nguoi dung, nen no khong di qua lib/auth.ts.
 *
 * XOA THAT PHAI DUOC BAT TUONG MINH: mac dinh la CHAY THU (chi liet ke). Muon
 * xoa that thi dat bien DON_VIDEO_CHAY_THAT=1 tren Vercel roi deploy lai — mot
 * hanh dong co y, khong phai thu tu bat duoc bang mot tham so tren dia chi.
 *
 *   ?thu=1   ep chay thu du bien moi truong da bat xoa that (de xem truoc).
 *   ?max=N   ha tran so tep cua luot nay. Chi ha duoc, khong nang duoc.
 *
 * Tra ve JSON bao cao day du (scripts/don-video.mjs in ra cho de doc). Chuoi o
 * day la chuoi MAY DOC, khong hien len man cua ai, nen khong qua lop dich.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const q = new URL(req.url).searchParams;
  const epChayThu = q.get('thu') === '1';

  // Tran so tep: bien moi truong la muc cua CRON (luot chay khong ai nhin), tham
  // so tren dia chi la muc cua LUOT NAY. Lay cai NHO HON — ca hai chi ha duoc,
  // con `donVideoQuaHan` kep them lan nua o MAX_MOI_LUOT_MAC_DINH.
  //
  // Dat ma khong doc duoc thi TU CHOI ngay tai day, truoc khi luot nay gianh
  // suat cua ngay: thay bang tran mac dinh la thay bang tran RONG NHAT, dung
  // chieu khong duoc phep sai tren duong xoa khong lui duoc (xem `tranNguoiDat`).
  const xinTrenDiaChi = tranNguoiDat(q.get('max'));
  const xinTrenMayChu = tranNguoiDat(process.env.DON_VIDEO_MAX_MOI_LUOT);
  if (xinTrenDiaChi === false || xinTrenMayChu === false) {
    return NextResponse.json(
      {
        error: 'max-khong-hop-le',
        chiTiet: xinTrenDiaChi === false ? 'max' : 'DON_VIDEO_MAX_MOI_LUOT',
        canLa: 'so nguyen duong',
      },
      { status: 400 }
    );
  }
  const max = Math.min(
    xinTrenDiaChi ?? MAX_MOI_LUOT_MAC_DINH,
    xinTrenMayChu ?? MAX_MOI_LUOT_MAC_DINH
  );

  const ketQua = await donVideoQuaHan({
    that: !epChayThu && process.env.DON_VIDEO_CHAY_THAT === '1',
    max,
  });

  return NextResponse.json(ketQua, { status: ketQua.loi ? 500 : 200 });
}
