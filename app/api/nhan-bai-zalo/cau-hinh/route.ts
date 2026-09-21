import { NextResponse } from 'next/server';
import { cauHinhChoAgent } from '@/lib/nhanBaiZalo';
import { xacThucZalo } from '@/lib/xacThucZalo';

export const dynamic = 'force-dynamic';

/**
 * GET /api/nhan-bai-zalo/cau-hinh — danh sach nguon DANG BAT cho zalo-agent.
 *
 * btvn la NGUON SU THAT DUY NHAT cua cau hinh nay (captain: nhom, con, ten co
 * "nên config được", khong ghi cung trong ma): zalo-agent doc lai moi lan chay
 * nen captain them mot lop moi chi phai go o man bo me, khong phai sua ma hay
 * deploy lai ben nao.
 *
 * KHONG loc theo nha: cua nay khong co cookie, va mot cai Mac mini phuc vu mot
 * nha — nhung dieu do la mot GIA DINH, khong phai mot bao dam. Neu sau nay co
 * nha thu hai dung zalo-agent thi moi khoa phai la mot khoa rieng theo nha; ghi
 * o day de nguoi sau khong tuong la da co san.
 *
 * Cung khuon xac thuc va cung "chuoi may doc" voi POST cung thu muc.
 */
export async function GET(req: Request) {
  const xac = xacThucZalo(req);
  if (!xac.ok) return NextResponse.json({ loi: xac.loi }, { status: xac.status });
  return NextResponse.json(await cauHinhChoAgent());
}
