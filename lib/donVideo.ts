/**
 * Don dinh ky video con da nop khoi kho tep.
 *
 * LUAT — captain chot 2026-09-10, nguyen van hai lan noi:
 *   "nhung video da qua 5 ngay ve co ban khong can luu lai"
 *   "do ngay nao con cung di hoc va co bai tap. Nen kieu gi cung phai nop bai
 *    cho co. Vay nen chi can giu lai 3-5 cuoi cung la okie roi"
 *
 * Nen xoa mot video khi CA HAI dieu kien dung CUNG LUC:
 *   a. da qua SO_NGAY_GIU_VIDEO ngay ke tu luc con nop, VA
 *   b. khong nam trong SO_VIDEO_MOI_NHAT_GIU_LAI video moi nhat CUA CHINH CON DO.
 *
 * VA chu khong phai HOAC, va do la ca thiet ke: dieu kien (a) mot minh se xoa
 * het video cu du con lau roi khong nop them cai nao — con (b) mot minh co the
 * xoa mot video vua nop SANG NAY neu hom do con nop sau bai. Hai cai cung luc
 * thi khong bao gio mat video moi, ma dung luong van co tran doan duoc:
 * so con x 5 video.
 *
 * Dem theo TUNG CON chu khong gop ca nha: con nop nhieu se day video cua con
 * nop it ra ngoai, khong phai y captain.
 *
 * XOA TEP TREN KHO KHONG LUI DUOC. Ca tep nay duoc viet quanh mot cau do:
 * moi hang rao deu nam TRUOC luc pha, khong cai nao la duong lui.
 *
 *   1. CHAY THU LA MAC DINH. `that` phai duoc nguoi goi bat tuong minh
 *      (route doc DON_VIDEO_CHAY_THAT === '1'). Khong bat thi chi liet ke.
 *   2. TRAN SO TEP MOI LUOT (MAX_MOI_LUOT_MAC_DINH). Mot loi logic te nhat cung
 *      chi mat chung do tep mot dem, khong mat ca kho.
 *   3. DANH SACH TRANG CUNG (`laUrlVideoConNop`) kiem NGAY TRUOC khi goi del():
 *      chi https, chi host Vercel Blob, chi thu muc `nop-bai/`. No chan mot luot
 *      link Google Drive bo me dan vao (assignment_media), duong `/api/tep/...`
 *      cua che do dev, `data:` URL cua anh dai dien tam, va URL example.com cua
 *      ba nha demo. URL nao truot hang rao nay thi BI BO QUA va bao ra, khong
 *      bao gio doan them.
 *   4. HAI DONG HO. Chi xoa khi CA `submitted_video_at` trong CSDL LAN
 *      `uploadedAt` cua chinh kho tep deu qua han. Hai nguon doc lap, chan dung
 *      loai loi nguy hiem nhat o day: sai mui gio hoac sai phep tinh khoang.
 *   5. SO CAI GHI CUNG LUC VOI LUC GO. Dong `video_cleanups` va cau go URL khoi
 *      `assignments` di trong CUNG MOT cau SQL (CTE), va ca hai xong xuoi TRUOC
 *      khi del() chay. Nen o moi thoi diem, duong dan sap mat da nam trong so
 *      cai roi — do la ban sao duy nhat con lai sau khi tep bien mat.
 *   6. Lan chay THAT dau tien do captain bam tay, sau khi doc danh sach cua mot
 *      lan chay thu (scripts/don-video.mjs).
 *   7. Nha demo bi loai ngay trong cau SELECT (`fam\_demo\_%`).
 *
 * VI SAO GO URL TRONG CSDL LA BAT BUOC, khong phai tuy chon: moi cho ve video
 * deu kiem rong san (`coVideo` trong ChiaSeVideo, `{submittedVideoUrl && …}`
 * trong SuaBai, `{existingUrl && …}` trong QuayVideo) nen URL = NULL la man hinh
 * tu thu gon lai. Nguoc lai, de nguyen URL ma xoa tep thi bo me thay trinh phat
 * den, va te nhat: nut "Chia se" o man nop bai cho co tut xuong nhanh du phong
 * va gui cho co mot DUONG LIEN KET CHET.
 */

import { del, head } from '@vercel/blob';
import { query, queryTx, type CauSQL } from './db';
import { newId } from './store';

/** Video con nop phai qua bao nhieu ngay moi duoc don. Captain chot: 5. */
export const SO_NGAY_GIU_VIDEO = 5;

/**
 * SO VIDEO MOI NHAT CUA MOI CON luon duoc giu lai, du chung da bao nhieu ngay.
 *
 * Doi con so nay la sua DUNG MOT DONG. Captain cho khoang 3 den 5; chon 3 vi
 * phep tinh tran dung luong: mot ban quay 10 phut ≈ 82MB (lib/media.ts:185) va
 * tran mot tep la 700MB (MAX_NOP_VIDEO_BYTES). Giu 5 video moi con thi hai con
 * da ≈ 820MB tren tran 1GB cua kho — gan nhu khong con cho cho dung cai truong
 * hop viec don nay sinh ra de chan: MOT video camera iPad co lon. Giu 3 thi hai
 * con ≈ 490MB, con cho.
 */
export const SO_VIDEO_MOI_NHAT_GIU_LAI = 3;

/** Tran so tep moi luot. Nguoi goi ha xuong duoc, khong nang len duoc. */
export const MAX_MOI_LUOT_MAC_DINH = 20;

/** Chia lo khi goi del(): mot lo la mot vong goi. Tai lieu khong neu tran nen tu dat. */
const CO_LO_XOA = 100;

const HOST_KHO = /(^|\.)blob\.vercel-storage\.com$/;
/** Chi thu muc video con nop. `dinh-kem/` (tep bo me) va `bai-tap/` (anh) khong dinh toi. */
const DUONG_NOP_BAI = /^\/nop-bai\/[^/]+$/;

/**
 * URL nay co phai MOT VIDEO CON NOP nam tren kho tep cua minh khong?
 *
 * Ham nay la cai chot cuoi cung truoc del(). No CO Y chat hon `laUrlTepAppCap`
 * (lib/media.ts): ham do tra loi "app minh co cap URL nay khong" de nhan mot URL
 * GHI VAO CSDL, con ham nay tra loi "co duoc phep XOA khong". Chat hon thi cung
 * lam mot URL that bi bo sot — va do la huong sai an toan: bo sot chi la khong
 * don duoc (va lan chay thu in ra het cho ma nhin), xoa nham la mat bai cua con.
 */
export function laUrlVideoConNop(url: unknown): url is string {
  if (typeof url !== 'string' || !url || url.length > 2048) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return u.protocol === 'https:' && HOST_KHO.test(u.hostname) && DUONG_NOP_BAI.test(u.pathname);
}

/**
 * Chon video du CA HAI dieu kien xoa.
 *
 * `hang` duoc danh TRONG PHAM VI MOT CON (`PARTITION BY a.child_id`) va tren
 * TOAN BO video cua con do — CTE khong loc theo ngay, vi thu hang phai la "cai
 * moi thu may cua con nay", khong phai "cai moi thu may trong so nhung cai da
 * cu". Loc theo ngay nam o cau ngoai, sau khi da danh hang.
 *
 * `a.id DESC` la moc pha the: hai video cung mot moc thoi gian van phai ra thu
 * tu on dinh, khong thi hai luot chay lien nhau co the chon hai tap khac nhau.
 *
 * `fam\_demo\_%`: dau gach duoi la ky tu dai dien cua LIKE nen phai thoat, khong
 * thi mau con bat ca nhung id khong phai nha demo.
 *
 * $1 = so video moi nhat giu lai, $2 = so ngay giu, $3 = so tep toi da moi luot.
 */
export const SQL_CHON_VIDEO_QUA_HAN = `
  WITH xep AS (
    SELECT a.id, a.child_id, a.source, a.submitted_video_url, a.submitted_video_at,
           ROW_NUMBER() OVER (
             PARTITION BY a.child_id
             ORDER BY a.submitted_video_at DESC, a.id DESC
           ) AS hang
      FROM assignments a
      JOIN children c ON c.id = a.child_id
     WHERE a.submitted_video_url IS NOT NULL
       AND a.submitted_video_at IS NOT NULL
       AND c.family_id NOT LIKE 'fam\\_demo\\_%'
  )
  SELECT id, child_id, source, submitted_video_url, submitted_video_at, hang
    FROM xep
   WHERE hang > $1::int
     AND submitted_video_at < now() - ($2::int * interval '1 day')
   ORDER BY submitted_video_at
   LIMIT $3::int`;

/**
 * Go URL khoi bai VA ghi so cai trong CUNG MOT cau — hang rao 5.
 *
 * Dieu kien `submitted_video_url = $4` chan dung mot cuoc dua co that: con quay
 * lai bai do trong khoang giua luc SELECT va luc UPDATE. Luc do URL da khac,
 * cau nay khong dong vao dong nao, khong ghi so cai, va nguoi goi khong xoa tep
 * do (no da thanh tep mo coi, de dot don mo coi sau lo).
 *
 * $1 so cai id, $2 run id, $3 assignment id, $4 url, $5 bytes, $6 submitted_video_at.
 */
export const SQL_GO_VA_GHI_SO = `
  WITH da_go AS (
    UPDATE assignments
       SET submitted_video_url = NULL, submitted_video_at = NULL
     WHERE id = $3 AND submitted_video_url = $4
     RETURNING id, child_id
  )
  INSERT INTO video_cleanups
    (id, run_id, assignment_id, child_id, url, bytes, submitted_video_at)
  SELECT $1, $2, da_go.id, da_go.child_id, $4, $5::bigint, $6::timestamptz
    FROM da_go
  RETURNING id, assignment_id, url`;

export type CheDoDon = 'thu' | 'that';

export interface MucDon {
  assignmentId: string;
  childId: string;
  source: string;
  url: string;
  /** Thu hang trong so video cua CHINH con do, 1 = moi nhat. */
  hang: number;
  /** Tu head() cua kho; null khi chua hoi duoc (chay thu, khong co token). */
  bytes: number | null;
  submittedVideoAt: string;
}

export interface KetQuaDon {
  cheDo: CheDoDon;
  runId: string | null;
  /** Vi sao khong lam gi ca. */
  boQua?: 'da-chay-hom-nay' | 'chua-bat-kho-tep';
  /** Nhung dong lot qua HET moi hang rao — chay thu thi day la "se xoa". */
  ungVien: MucDon[];
  /** Nhung dong bi mot hang rao CHAN LAI, kem ly do. Chay thu phai in ra het. */
  boSot: { assignmentId: string; url: string; vi: string }[];
  /** Canh bao cua CA LUOT — khong chan dong nao, nhung nguoi doc phai biet. */
  canhBao: string[];
  /** assignmentId da xoa xong that su (rong khi chay thu). */
  daXoa: string[];
  soBytes: number;
  loi: string | null;
}

/** Doi cot ngay cua Neon (string) hay PGlite (Date) ve ISO. */
const isoCua = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));

interface DongChon {
  id: string;
  child_id: string;
  source: string;
  submitted_video_url: string;
  submitted_video_at: string | Date;
  hang: number | string;
}

const coKhoTep = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/**
 * Mot luot don.
 *
 * `that = false` (mac dinh) chi doc va liet ke: khong ghi so cai, khong go URL,
 * khong goi del(). Dung de captain nhin danh sach truoc khi bat xoa that.
 */
export async function donVideoQuaHan(
  tuyChon: { that?: boolean; max?: number } = {}
): Promise<KetQuaDon> {
  const that = tuyChon.that === true;
  const max = Math.max(1, Math.min(tuyChon.max ?? MAX_MOI_LUOT_MAC_DINH, MAX_MOI_LUOT_MAC_DINH));
  const ra: KetQuaDon = {
    cheDo: that ? 'that' : 'thu', runId: null,
    ungVien: [], boSot: [], canhBao: [], daXoa: [], soBytes: 0, loi: null,
  };

  // Xoa that ma khong co token thi khong the goi del() — dung lai thay vi go URL
  // trong CSDL roi de tep nam lai (vua hong man hinh vua khong tiet kiem duoc gi).
  if (that && !coKhoTep()) {
    ra.boQua = 'chua-bat-kho-tep';
    return ra;
  }

  // Gianh cho cua ngay — hang rao chong chay trung (chi muc UNIQUE tung phan chi
  // ap cho luot 'that'; luot 'thu' khong bao gio dung nhau).
  const runId = newId('vcr');
  const claim = await query<{ id: string }>(
    `INSERT INTO video_cleanup_runs (id, run_date, che_do) VALUES ($1, CURRENT_DATE, $2)
     ON CONFLICT DO NOTHING RETURNING id`,
    [runId, ra.cheDo]
  );
  if (claim.length === 0) {
    ra.boQua = 'da-chay-hom-nay';
    return ra;
  }
  ra.runId = runId;

  try {
    const dong = await query<DongChon>(SQL_CHON_VIDEO_QUA_HAN, [
      SO_VIDEO_MOI_NHAT_GIU_LAI, SO_NGAY_GIU_VIDEO, max,
    ]);

    // Khong co token thi khong hoi duoc kho. Chi xay ra o luot CHAY THU (nhanh
    // tren da chan chay that), nen day la canh bao cua ca luot chu khong phai
    // hang rao chan tung dong: bao MOT lan, dung nhet vao boSot tung dong.
    if (dong.length > 0 && !coKhoTep()) ra.canhBao.push('chua-kiem-dong-ho-thu-hai');

    const hanCu = Date.now() - SO_NGAY_GIU_VIDEO * 86_400_000;
    for (const d of dong) {
      const url = d.submitted_video_url;

      // Hang rao 3
      if (!laUrlVideoConNop(url)) {
        ra.boSot.push({ assignmentId: d.id, url, vi: 'khong-phai-video-con-nop-tren-kho' });
        continue;
      }

      // Hang rao 4 — dong ho thu hai.
      let bytes: number | null = null;
      if (coKhoTep()) {
        try {
          const tin = await head(url);
          bytes = tin.size;
          if (new Date(tin.uploadedAt).getTime() > hanCu) {
            ra.boSot.push({ assignmentId: d.id, url, vi: 'kho-bao-tep-con-moi' });
            continue;
          }
        } catch {
          // Tep da bien mat, hoac kho tra loi loi mot lan. Khong phan biet duoc
          // hai truong hop nen chon huong an toan: bo qua luot nay.
          ra.boSot.push({ assignmentId: d.id, url, vi: 'khong-hoi-duoc-kho' });
          continue;
        }
      }

      ra.ungVien.push({
        assignmentId: d.id,
        childId: d.child_id,
        source: d.source,
        url,
        hang: Number(d.hang),
        bytes,
        submittedVideoAt: isoCua(d.submitted_video_at),
      });
      ra.soBytes += bytes ?? 0;
    }

    if (that && ra.ungVien.length > 0) await xoaThat(runId, ra);
  } catch (e) {
    ra.loi = e instanceof Error ? e.message : String(e);
  }

  await query(
    `UPDATE video_cleanup_runs SET finished_at = now(), so_tep = $2, so_bytes = $3, loi = $4 WHERE id = $1`,
    [runId, that ? ra.daXoa.length : ra.ungVien.length, ra.soBytes, ra.loi]
  );
  return ra;
}

/** Hang rao 5: ghi so cai + go URL trong mot cau, xong het roi moi del(). */
async function xoaThat(runId: string, ra: KetQuaDon): Promise<void> {
  const cau: CauSQL[] = ra.ungVien.map((m) => ({
    sql: SQL_GO_VA_GHI_SO,
    params: [newId('vcl'), runId, m.assignmentId, m.url, m.bytes, m.submittedVideoAt],
  }));
  const ketQua = await queryTx<{ id: string; assignment_id: string; url: string }>(cau);
  const daGo = ketQua.flat();

  // Dong nao khong go duoc (con vua quay lai) thi KHONG xoa tep — no da thanh
  // tep mo coi, khong con ai tro toi, de dot don mo coi sau lo.
  for (const m of ra.ungVien) {
    if (!daGo.some((g) => g.assignment_id === m.assignmentId)) {
      ra.boSot.push({ assignmentId: m.assignmentId, url: m.url, vi: 'video-vua-doi-giua-chung' });
      ra.soBytes -= m.bytes ?? 0;
    }
  }
  if (daGo.length === 0) return;

  for (let i = 0; i < daGo.length; i += CO_LO_XOA) {
    const lo = daGo.slice(i, i + CO_LO_XOA);
    await del(lo.map((g) => g.url));
    await query(`UPDATE video_cleanups SET deleted_at = now() WHERE id = ANY($1::text[])`,
      [lo.map((g) => g.id)]);
    ra.daXoa.push(...lo.map((g) => g.assignment_id));
  }
}
