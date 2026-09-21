import { NextResponse } from 'next/server';
import { moCuaNhanTin } from '@/lib/nhanBaiZalo';
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
 *   2. HOI TRUOC DUNG NHUNG GI CUA NHAN TIN SE HOI. `moCuaNhanTin` — MOT ham
 *      dung chung voi `nhanTinZalo`, khong phai ban chep — tu choi nguon la,
 *      nguon dang tat, nguon chua gan con, va `ma_tin` da co. Ve chi co ich khi
 *      no tu choi DUNG tap tin ma buoc sau cung tu choi: mot bo tep ky duoc ve
 *      roi bi 404 o buoc gui tin la tep mo coi khong `han_xoa`, khong luot don
 *      nao thu hoi duoc (kho 1GB da dung 219MB).
 *
 * MOT TEN TRUONG LOI: `loi`, giong hai cua kia — ke ca nhung ma do than chung
 * `xuLyTaiTep` sinh ra (`tenTruongLoi`). Cua nay la cua cho MAY, ma may thi doc
 * log bang dung mot khoa.
 *
 * XAC THUC NAM TRONG `cau.auth`, KHONG o dau route — chi nhanh
 * `blob.generate-client-token` moi bi hoi khoa. Su kien `blob.upload-completed`
 * do may chu cua Vercel Blob goi ve chinh URL nay mang `x-vercel-signature` chu
 * khong mang `Authorization: Bearer`, va `handleUpload` tu kiem chu ky do (xem
 * lib/upload-route.ts). Chan no bang 401 la ve ky xong, tep len kho xong, roi
 * @vercel/blob bao loi ve cho ben tai — agent coi nhu that bai va gui lai moi
 * 30 phut mai mai. Rieng 503 thi van o dau route: do la loi cua BAN DEPLOY,
 * khong phai cua nguoi goi.
 *
 * Ma tra ve:
 *   200  ve (than do @vercel/blob/client sinh), hoac `{ url }` o che do dev
 *   400  thieu nguon_id / ma_tin, hoac duong dan sai khuon
 *   401  xin ve ma thieu hoac sai khoa (khong noi la cai nao)
 *   404  nguon_id khong co, nguon dang tat, hoac nguon chua gan con nao
 *   409  `ma_tin` da co cho nguon do
 *   501  chua bat Vercel Blob (tren Vercel), hoac che do dev khong dung duoc
 *   503  may chu chua dat ZALO_INTAKE_SECRET
 */
export async function POST(req: Request) {
  const xac = xacThucZalo(req);
  if (!xac.ok && xac.status === 503) {
    return NextResponse.json({ loi: xac.loi }, { status: 503 });
  }

  const q = new URL(req.url).searchParams;
  const nguonId = (q.get('nguon_id') ?? '').trim();
  const maTin = (q.get('ma_tin') ?? '').trim();

  return xuLyTaiTep(req, {
    auth: async () => xacThucZalo(req).ok,
    kiemTruocKhiNhan: async () => {
      if (!nguonId) return NextResponse.json({ loi: 'thieu-nguon-id' }, { status: 400 });
      if (!maTin) return NextResponse.json({ loi: 'thieu-ma-tin' }, { status: 400 });
      const cong = await moCuaNhanTin(nguonId, maTin);
      if (cong.ok) return null;
      return NextResponse.json(
        { loi: cong.loi },
        { status: cong.loi === 'trung-ma-tin' ? 409 : 404 }
      );
    },
    tenTruongLoi: 'loi',
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
