import { NextResponse } from 'next/server';
import { getNguonZaloChoCuaNhan, tinZaloDaCo } from '@/lib/nhanBaiZalo';
import { laDuongDanTepZalo, LOAI_TEP_NHAN, MAX_BYTES_MOI_TEP } from '@/lib/zalo';
import { xuLyTaiTep } from '@/lib/upload-route';
import { xacThucZalo } from '@/lib/xacThucZalo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/nhan-bai-zalo/tep-token?nguon_id=<id>&ma_tin=<ma> — ve cho
 * zalo-agent tai tep cua co THANG len kho tep.
 *
 * MAY GOI, KHONG PHAI NGUOI — cung khoa Bearer va cung "chuoi may doc" voi hai
 * cua kia trong thu muc nay.
 *
 * Vi sao co route nay: Vercel chan than request o 4.5MB, nen duong cu (tep di
 * kem goi tin duoi dang base64) lam chinh goi mau THAT cua scout — hai video
 * 2.18MB + 1.29MB, ~4.63MB sau base64 — bi 413 TRUOC khi ham chay. Khong dong
 * `bai_tu_zalo`, khong ban nhap, khong log, va agent gui lai moi 30 phut mai
 * mai. Day la DUNG khuon ma lib/media.ts da chon cho video con nop vi dung ly
 * do do, nen than route dung chung `xuLyTaiTep` (lib/upload-route.ts) chu khong
 * viet ban sao thu ba: ten tep `<32 hex><duoi>` cua che do dev la hop dong ma
 * `GET /api/tep` va `laUrlTepAppCap` cung doc.
 *
 * Hai thu route nay them so voi hai route tai tep cu:
 *
 *   1. DUONG DAN BI CHOT. Ve chi duoc ky cho `zalo/<nguon_id>/<yyyy-mm-dd>/<ten>`
 *      (`kiemDuongDan`). `nguon_id` nam trong CHINH duong dan va cua nhan tin
 *      doi chieu lai bang cung mot ham, nen mot khoa hop le khong ghi duoc tep
 *      vao ho cua nguon khac, khong dam vao `nop-bai/` cua video con nop.
 *   2. KIEM TRUNG TRUOC KHI PHAT VE. `ma_tin` da co cho nguon do -> 409 ngay,
 *      de agent khoi tai len mot bo tep ma cua nhan tin se tu choi — cung ly do
 *      dung luong voi phep kiem trung o `nhanTinZalo` (kho 1GB da dung 219MB).
 *
 * Ma tra ve:
 *   200  ve (than do @vercel/blob/client sinh), hoac `{ url }` o che do dev
 *   400  thieu nguon_id / ma_tin, hoac duong dan sai khuon
 *   401  thieu hoac sai khoa (khong noi la cai nao)
 *   404  nguon_id khong co
 *   409  `ma_tin` da co cho nguon do
 *   501  chua bat Vercel Blob (tren Vercel), hoac che do dev khong dung duoc
 *   503  may chu chua dat ZALO_INTAKE_SECRET
 */
export async function POST(req: Request) {
  const xac = xacThucZalo(req);
  if (!xac.ok) return NextResponse.json({ loi: xac.loi }, { status: xac.status });

  const q = new URL(req.url).searchParams;
  const nguonId = (q.get('nguon_id') ?? '').trim();
  const maTin = (q.get('ma_tin') ?? '').trim();
  if (!nguonId) return NextResponse.json({ loi: 'thieu-nguon-id' }, { status: 400 });
  if (!maTin) return NextResponse.json({ loi: 'thieu-ma-tin' }, { status: 400 });

  const nguon = await getNguonZaloChoCuaNhan(nguonId);
  if (!nguon) return NextResponse.json({ loi: 'khong-co-nguon' }, { status: 404 });
  if (await tinZaloDaCo(nguonId, maTin)) {
    return NextResponse.json({ loi: 'trung-ma-tin' }, { status: 409 });
  }

  return xuLyTaiTep(req, {
    auth: async () => true,
    duoiMacDinh: (mime) => {
      const m = mime.toLowerCase().split(';')[0].trim();
      if (m === 'application/pdf') return '.pdf';
      if (m.startsWith('image/')) return '.jpg';
      if (m.startsWith('audio/')) return '.m4a';
      if (m.startsWith('video/')) return '.mp4';
      return null;
    },
    maxBytes: MAX_BYTES_MOI_TEP,
    allowedContentTypes: [...LOAI_TEP_NHAN],
    kiemDuongDan: (pathname) => laDuongDanTepZalo(pathname, nguonId),
    loi: {
      chuaXacThuc: 'unauthorized',
      chuaBatBlobTrenVercel: 'chua-bat-vercel-blob',
      thieuTep: 'thieu-tep',
      saiLoai: 'tep-sai-loai',
      quaNang: 'tep-qua-nang',
      taiLoi: 'tai-tep-loi',
      chuaBatBlob: 'chua-bat-vercel-blob',
      duLieuHong: 'du-lieu-hong',
      saiDuongDan: 'sai-duong-dan',
    },
  });
}
