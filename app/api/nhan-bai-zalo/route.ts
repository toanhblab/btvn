import { NextResponse } from 'next/server';
import { nhanTinZalo } from '@/lib/nhanBaiZalo';
import { docGoiTin } from '@/lib/zalo';
import { xacThucZalo } from '@/lib/xacThucZalo';

export const dynamic = 'force-dynamic';
// Tach bai bang AI co the mat toi 45s (lib/ai.ts tu cat o do), cong voi luc tai
// tep len kho — dat tran ro rang nhu /api/extract va /api/don-video.
export const maxDuration = 60;

/**
 * POST /api/nhan-bai-zalo — MOT tin giao bai cua co tren nhom Zalo.
 *
 * MAY GOI, KHONG PHAI NGUOI: zalo-agent (kho toanhblab/zalo-agent, chay tren
 * Mac mini) doc tin roi goi vao day. Nen route nay KHONG dinh gi toi PIN bo me
 * hay cookie thiet bi — no khong di qua lib/auth.ts — va moi chuoi tra ve la
 * CHUOI MAY DOC, khong qua lop dich (cung tinh than voi /api/don-video).
 *
 * Xac thuc: `Authorization: Bearer <ZALO_INTAKE_SECRET>` (lib/xacThucZalo.ts).
 * Than goi + luat lam sach: lib/zalo.ts. Xu ly: lib/nhanBaiZalo.ts.
 *
 * Ma tra ve — hop dong da chot voi zalo-agent, doi la doi ca hai ben:
 *   201  tao xong  { bai_zalo_id, so_bai_nhap, con: [{ id, ten }], tep_bo_qua }
 *   400  goi hong: THIEU TRUONG bat buoc, hoac qua 10 tep  { loi }
 *   401  thieu hoac sai khoa (khong noi la cai nao)
 *   404  nguon_id khong co, hoac nguon dang tat, hoac nguon chua gan con nao
 *   409  `ma_tin` da co cho nguon do — KHONG tao gi. zalo-agent chay lai moi 30
 *        phut nen day la duong binh thuong, khong phai loi.
 *   503  may chu chua dat ZALO_INTAKE_SECRET
 *
 * KHONG BAO GIO 500 TAY KHONG (hop dong): bo tach bai hong thi van 201 — ban
 * goc cua tin da nam trong CSDL va bo me van co bai nhap tho de sua. Chi mot
 * loi CSDL that su moi ra 500, va luc do zalo-agent thu lai an toan nho 409.
 *
 * TEP KHONG DI TRONG THAN REQUEST (Vercel chan o 4.5MB — xem lib/zalo.ts):
 * zalo-agent xin ve o `POST /api/nhan-bai-zalo/tep-token` roi tai thang len
 * kho, va `dinh_kem[]` o day chi mang `{ ten, loai, kich_thuoc, gui_luc, url }`.
 *
 * Cung mot luat cho TEP: mot tep sai loai (.docx), qua 25MB, hay `url` khong
 * phai tep cua kho minh khong lam hong ca tin — no bi bo rieng va bao ra trong
 * `tep_bo_qua` cua than 201. Danh sach loai tep nhan, tran dung luong va CACH
 * tai nam o `gioi_han` cua GET cau-hinh, de zalo-agent biet TRUOC chu khong
 * phai doan.
 */
export async function POST(req: Request) {
  const xac = xacThucZalo(req);
  if (!xac.ok) return NextResponse.json({ loi: xac.loi }, { status: xac.status });

  const body = await req.json().catch(() => null);
  const doc = docGoiTin(body);
  if ('loi' in doc) {
    return NextResponse.json({ loi: doc.loi }, { status: 400 });
  }

  const kq = await nhanTinZalo(doc.goi);
  if (!kq.ok) {
    return NextResponse.json(
      { loi: kq.loi },
      { status: kq.loi === 'trung-ma-tin' ? 409 : 404 }
    );
  }

  return NextResponse.json(
    {
      bai_zalo_id: kq.baiZaloId, so_bai_nhap: kq.soBaiNhap, con: kq.con,
      tep_bo_qua: kq.tepBoQua,
    },
    { status: 201 }
  );
}
