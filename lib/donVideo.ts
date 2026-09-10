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
 * so con x SO_VIDEO_MOI_NHAT_GIU_LAI (3) video.
 *
 * Dem theo TUNG CON chu khong gop ca nha: con nop nhieu se day video cua con
 * nop it ra ngoai, khong phai y captain.
 *
 * XOA TEP TREN KHO KHONG LUI DUOC. Ca tep nay duoc viet quanh mot cau do:
 * moi hang rao deu nam TRUOC luc pha, khong cai nao la duong lui. CHIN cai, xep
 * theo dung thu tu mot luot di qua chung:
 *
 *   1. CHAY THU LA MAC DINH. `that` phai duoc nguoi goi bat tuong minh
 *      (route doc DON_VIDEO_CHAY_THAT === '1'). Khong bat thi chi liet ke.
 *   2. TRAN SO TEP MOI LUOT (MAX_MOI_LUOT_MAC_DINH). Mot loi logic te nhat cung
 *      chi mat chung do tep mot dem, khong mat ca kho. Tran nay la MOT tui chung
 *      cho ca luot: phan don not so cai tieu truoc, phan chon viec moi chi duoc
 *      dung cho con lai. Hai tui rieng la tran doi len gap doi ma van tuong la mot.
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
 *      cai roi — do la ban sao duy nhat con lai sau khi tep bien mat. Vi the
 *      del() hong la de lai mot tep KHONG con ai tro toi, va luot sau khong
 *      nhin thay no qua `assignments` nua: moi luot phai doc lai dong so cai
 *      `deleted_at IS NULL` va don not (`donSoCaiMoCoi`) truoc khi chon viec moi.
 *   6. CAU DAO NGAT: don not ma del() van hong thi DUNG CA LUOT ngay, khong chon
 *      viec moi. Kho vua tu choi xoa, ma go URL di truoc del() nen chon them viec
 *      la bien mot dong ton bi chan thanh mot dong ton LON DAN: moi dem them
 *      `max` video mat cho xem va mat nut "Chia se", ma khong doi lay mot byte
 *      nao. Co cau dao ngat thi kho hong chi lam viec don DUNG LAI, khong lam no
 *      pha them.
 *   7. CHONG CHAY TRUNG: mot luot 'that' moi ngay, chan bang CHI MUC UNIQUE TUNG
 *      PHAN `(run_date) WHERE che_do = 'that'` chu khong bang code — tai lieu cua
 *      Vercel noi thang cron "co the goi cung mot luot hon mot lan". Luot 'thu'
 *      khong bi chan vi no khong pha gi.
 *   8. Lan chay THAT dau tien do captain bam tay, sau khi doc danh sach cua mot
 *      lan chay thu (scripts/don-video.mjs). Day la buoc NGUOI, khong co test.
 *   9. Nha demo bi loai ngay trong cau SELECT (`fam\_demo\_%`).
 *
 * `submitted_video_at` thi GIU LAI (chi URL bi go) — xem SQL_GO_VA_GHI_SO. Cap
 * "URL rong ma moc nop con" la trang thai 'da-don' cua `trangThaiVideo`
 * (lib/types.ts): moi man cua bo me doc trang thai video deu di qua ham do, dung
 * tu viet lai dieu kien o man moi.
 *
 * VI SAO GO URL TRONG CSDL LA BAT BUOC, khong phai tuy chon: moi cho PHAT hay
 * CHIA SE tep deu kiem rong san (`{submittedVideoUrl && …}` trong SuaBai,
 * `{existingUrl && …}` trong QuayVideo, `coVideo` trong ChiaSeVideo) nen
 * URL = NULL la khung phat va nut chia se tu thu gon lai. Nguoc lai, de nguyen
 * URL ma xoa tep thi bo me thay trinh phat den, va te nhat: nut "Chia se" o man
 * nop bai cho co tut xuong nhanh du phong va gui cho co mot DUONG LIEN KET CHET.
 */

import { del, head } from '@vercel/blob';
import { lechNgay } from './ngay';
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

/**
 * Bao nhieu ngay khong co luot nao thi coi la viec don da ngung.
 *
 * BA, khong phai mot: cron chay moi dem nhung goi Hobby chi bao dam "khoang mot
 * lan/ngay" va lech duoc toi 59 phut, nen mot dem lo khong noi len dieu gi va
 * bao dong vi no chi lam bo me lo hao. Ba dem lien khong co dong nao thi chac.
 */
export const SO_NGAY_COI_LA_NGUNG = 3;

/**
 * Lau roi khong co luot don nao?
 *
 * MOT cau hoi nay la cau tra loi CHUNG cho moi kieu hong, dung tach thanh nhanh
 * rieng cho tung kieu: CRON_SECRET bi doi (route tra 401 moi lan goi), route 500,
 * luot chet giua chung, migration chua chay, CSDL khong noi duoc, hay cron bi go
 * khoi vercel.json — tat ca deu hien ra dung MOT dau hieu: khong co dong moi nao
 * trong `video_cleanup_runs`.
 *
 * Dung de man Cai dat noi that: mot dong "Da don ngay 30/9" mau binh thuong hien
 * suot thang 10 la mot cau DUNG ma vo dung.
 */
export function lauKhongDon(ngayLuotGanNhat: string, homNay: string): boolean {
  return ngayLuotGanNhat < lechNgay(homNay, -SO_NGAY_COI_LA_NGUNG);
}

/** Chia lo khi goi del(): mot lo la mot vong goi. Tai lieu khong neu tran nen tu dat. */
const CO_LO_XOA = 100;

/**
 * Cua so QUET rong hon tran xoa cua luot.
 *
 * `max` la tran SO TEP BI XOA nen no phai duoc dem SAU cac hang rao, khong phai
 * o LIMIT cua cau chon. Dat o LIMIT thi mot dong bi hang rao chan VINH VIEN
 * (URL Google Drive bo me dan vao, hay tep da bien mat khoi kho nen head() luon
 * loi) van la dong CU NHAT nen luot nao cung duoc chon truoc, an het cho, va
 * viec don dung han trong im lang: luot chay bao thanh cong voi 0 tep con kho
 * thi cu day len. Quet rong hon roi dung tay khi da du `max` dong lot HET hang
 * rao thi dong bi chan chi ton mot cho trong CUA SO QUET, khong ton mot cho
 * trong tran xoa.
 */
const HE_SO_QUET = 5;
/** Tran cung cua cua so quet: moi dong la mot lan goi head(), route chi co 60s. */
const TRAN_QUET = 100;

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
 * $1 = so video moi nhat giu lai, $2 = so ngay giu, $3 = so dong QUET moi luot
 * (rong hon tran xoa cua luot — xem HE_SO_QUET).
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
 * cau nay khong dong vao dong nao, khong ghi so cai, va nguoi goi khong xoa tep.
 *
 * Tep CU tu day bi BO HAN, va phai noi thang ra vi de tuong nham dieu nguoc lai:
 * bai da tro sang video moi nen khong con ai tro toi no, va vi cau tren khong
 * ghi duoc dong so cai nao cho no nen `donSoCaiMoCoi` cung khong thay — KHONG co
 * dot don nao sau nay dong toi no nua. Do la huong dung: xoa mot tep ma minh
 * khong con biet chac la cua ai thi nguy hiem hon la de no nam do. Va no giong
 * het moi lan con bam "Quay video khac" — ban cu van nam lai tren kho. Muon thu
 * hoi ca lop tep do thi phai la mot dot quet KHAC (doi chieu `list()` cua kho
 * voi CSDL), khong phai viec cua tep nay.
 *
 * `submitted_video_at` CO Y duoc GIU LAI trong khi URL bi go: no la dau vet duy
 * nhat con lai tren chinh dong bai rang "bai nay TUNG co video, video da bi
 * don". Go ca hai thi bai da xong quay ve y het bai chua quay bao gio, va man
 * chi tiet con cua bo me dan lai the "Chờ quay video" cho mot bai con da nop
 * xong tu tuan truoc. Khong cho nao doc `submitted_video_at` mot minh de bat
 * dau mot luong nao (SuaBai chi doc no BEN TRONG khoi `submittedVideoUrl &&`),
 * va cau chon o tren doi CA HAI cot khac NULL nen dong da don khong bao gio
 * duoc chon lai.
 *
 * $1 so cai id, $2 run id, $3 assignment id, $4 url, $5 bytes, $6 submitted_video_at.
 */
export const SQL_GO_VA_GHI_SO = `
  WITH da_go AS (
    UPDATE assignments
       SET submitted_video_url = NULL
     WHERE id = $3 AND submitted_video_url = $4
     RETURNING id, child_id
  )
  INSERT INTO video_cleanups
    (id, run_id, assignment_id, child_id, url, bytes, submitted_video_at)
  SELECT $1, $2, da_go.id, da_go.child_id, $4, $5::bigint, $6::timestamptz
    FROM da_go
  RETURNING id, assignment_id, url`;

/**
 * So cai con so: dong da go URL khoi bai ma del() chua bao xoa xong.
 *
 * `planned_at` truoc thi don truoc — dong cu nhat la dong da mo coi lau nhat.
 *
 * $1 = so dong toi da moi luot.
 */
export const SQL_SO_CAI_CHUA_XOA = `
  SELECT id, assignment_id, url, bytes FROM video_cleanups
   WHERE deleted_at IS NULL
   ORDER BY planned_at
   LIMIT $1::int`;

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
  /** assignmentId cua so cai con so tu luot truoc, luot nay don not. */
  daXoaLai: string[];
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
    ungVien: [], boSot: [], canhBao: [], daXoa: [], daXoaLai: [], soBytes: 0, loi: null,
  };
  let byteDaXoa = 0;

  // Xoa that ma khong co token thi khong the goi del() — dung lai thay vi go URL
  // trong CSDL roi de tep nam lai (vua hong man hinh vua khong tiet kiem duoc gi).
  if (that && !coKhoTep()) {
    ra.boQua = 'chua-bat-kho-tep';
    return ra;
  }

  // Gianh cho cua ngay — hang rao 7, chong chay trung (chi muc UNIQUE tung phan
  // chi ap cho luot 'that'; luot 'thu' khong bao gio dung nhau).
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
    // Don not so cai con so TRUOC khi chon viec moi: nhung tep do da khong con
    // ai tro toi, khong luot nao sau nay nhin thay chung qua assignments nua.
    // No tieu vao CUNG tui tran voi phan chon viec moi (hang rao 2).
    byteDaXoa += await donSoCaiMoCoi(runId, ra, that, max);

    // Hang rao 6 — cau dao ngat. Kho vua tu choi xoa thi dung chon viec moi:
    // go URL cua chung di la chi lam dong ton phinh ra ma khong thu ve byte nao.
    if (ra.loi) {
      ra.canhBao.push('dung-vi-kho-dang-tu-choi-xoa');
      return await ketLuot(runId, ra, that, byteDaXoa);
    }

    const conLaiTrongTran = max - ra.daXoaLai.length;
    if (conLaiTrongTran <= 0) {
      ra.canhBao.push('het-tran-o-luot-don-not');
      return await ketLuot(runId, ra, that, byteDaXoa);
    }

    const dong = await query<DongChon>(SQL_CHON_VIDEO_QUA_HAN, [
      SO_VIDEO_MOI_NHAT_GIU_LAI, SO_NGAY_GIU_VIDEO,
      Math.min(conLaiTrongTran * HE_SO_QUET, TRAN_QUET),
    ]);

    // Khong co token thi khong hoi duoc kho. Chi xay ra o luot CHAY THU (nhanh
    // tren da chan chay that), nen day la canh bao cua ca luot chu khong phai
    // hang rao chan tung dong: bao MOT lan, dung nhet vao boSot tung dong.
    if (dong.length > 0 && !coKhoTep()) ra.canhBao.push('chua-kiem-dong-ho-thu-hai');

    const hanCu = Date.now() - SO_NGAY_GIU_VIDEO * 86_400_000;
    for (const d of dong) {
      // Hang rao 2 — cho con lai cua tui tran chung, dem SAU cac hang rao khac
      // (xem HE_SO_QUET).
      if (ra.ungVien.length >= conLaiTrongTran) {
        ra.canhBao.push('dung-o-tran-moi-luot');
        break;
      }
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

    if (that && ra.ungVien.length > 0) byteDaXoa += await xoaThat(runId, ra);
  } catch (e) {
    ra.loi = e instanceof Error ? e.message : String(e);
  }

  return await ketLuot(runId, ra, that, byteDaXoa);
}

/**
 * Dong so cua luot va tra ket qua ve.
 *
 * Chay THAT thi `soBytes` la so byte THAT SU mat, khong phai so du kien: dong
 * nao thua cuoc dua "con vua quay lai", dong nao nam trong lo del() hong, deu
 * khong duoc tinh — nen con so nay luon di doi voi so tep in ngay canh no. Chay
 * thu thi khong co gi mat, `soBytes` giu nguyen nghia "se xoa chung nay".
 */
async function ketLuot(
  runId: string, ra: KetQuaDon, that: boolean, byteDaXoa: number
): Promise<KetQuaDon> {
  if (that) ra.soBytes = byteDaXoa;
  await query(
    `UPDATE video_cleanup_runs SET finished_at = now(), so_tep = $2, so_bytes = $3, loi = $4 WHERE id = $1`,
    [runId, that ? ra.daXoa.length + ra.daXoaLai.length : ra.ungVien.length, ra.soBytes, ra.loi]
  );
  return ra;
}

/** Hang rao 5: ghi so cai + go URL trong mot cau, xong het roi moi del(). */
async function xoaThat(runId: string, ra: KetQuaDon): Promise<number> {
  const cau: CauSQL[] = ra.ungVien.map((m) => ({
    sql: SQL_GO_VA_GHI_SO,
    params: [newId('vcl'), runId, m.assignmentId, m.url, m.bytes, m.submittedVideoAt],
  }));
  const ketQua = await queryTx<{ id: string; assignment_id: string; url: string }>(cau);
  const daGo = ketQua.flat();

  // Dong nao khong go duoc (con vua quay lai) thi KHONG xoa tep. Tep cu bi bo
  // han o day: khong dong bai nao tro toi, cung khong co dong so cai nao, nen
  // donSoCaiMoCoi khong thay no — xem SQL_GO_VA_GHI_SO.
  for (const m of ra.ungVien) {
    if (!daGo.some((g) => g.assignment_id === m.assignmentId)) {
      ra.boSot.push({ assignmentId: m.assignmentId, url: m.url, vi: 'video-vua-doi-giua-chung' });
    }
  }
  if (daGo.length === 0) return 0;

  const byteCua = new Map(ra.ungVien.map((m) => [m.assignmentId, m.bytes]));
  return await xoaTheoLo(runId, ra, daGo.map((g) => ({
    ...g, bytes: byteCua.get(g.assignment_id) ?? null,
  })), ra.daXoa);
}

interface DongSoCai { id: string; assignment_id: string; url: string; bytes: number | string | null }

/**
 * Goi del() theo lo, dong dau so cai NGAY SAU moi lo, va CHIU DUOC mot lo hong.
 *
 * Khong nem loi ra ngoai: nem la bo luon cac lo sau, ma moi lo la mot nhom tep
 * doc lap — mot cu 500 cua kho khong duoc keo theo phan con lai cua luot. Lo
 * hong thi dong so cai giu nguyen `deleted_at IS NULL` va luot sau don not
 * (donSoCaiMoCoi), nhung `ra.loi` van duoc dat nen route tra 500 va man Cai dat
 * bao "bi loi giua chung" — hong ma bao thanh cong moi la cai nguy hiem.
 */
async function xoaTheoLo(
  runId: string, ra: KetQuaDon, dong: DongSoCai[], vao: string[]
): Promise<number> {
  let byte = 0;
  for (let i = 0; i < dong.length; i += CO_LO_XOA) {
    const lo = dong.slice(i, i + CO_LO_XOA);
    try {
      await del(lo.map((g) => g.url));
      // `deleted_run_id` ghi CUNG LUC voi `deleted_at`: dong "Don video cu" o man
      // Cai dat dem theo luot DA PHA chu khong theo luot da dinh pha (migration 020).
      await query(
        `UPDATE video_cleanups SET deleted_at = now(), deleted_run_id = $2 WHERE id = ANY($1::text[])`,
        [lo.map((g) => g.id), runId]
      );
      vao.push(...lo.map((g) => g.assignment_id));
      for (const g of lo) byte += Number(g.bytes ?? 0);
    } catch (e) {
      ra.loi = ra.loi ?? (e instanceof Error ? e.message : String(e));
      for (const g of lo) {
        ra.boSot.push({ assignmentId: g.assignment_id, url: g.url, vi: 'kho-khong-xoa-duoc' });
      }
    }
  }
  return byte;
}

/**
 * Don not nhung dong so cai con so — cai duong lui cua hang rao 5.
 *
 * Hang rao 5 go URL khoi bai TRUOC khi del() chay, nen mot cu del() hong de lai
 * dung tinh huong xau nhat: tep van nam tren kho ma KHONG con ai tro toi. Cau
 * chon chi di theo `assignments.submitted_video_url` nen khong luot nao sau nay
 * nhin thay chung nua; dong so cai `deleted_at IS NULL` la ban ghi duy nhat con
 * lai, nen moi luot phai doc lai chung truoc khi chon viec moi.
 *
 * Van qua danh sach trang (hang rao 3) truoc khi goi del(). Tieu vao CUNG tui
 * tran voi phan chon viec moi (hang rao 2): no chay truoc nen no tieu truoc, va
 * nguoi goi chi duoc dung cho con lai. Luot chay THU khong xoa gi, chi bao ra
 * con bao nhieu dong.
 *
 * Tra ve so byte that su lay lai duoc.
 */
async function donSoCaiMoCoi(
  runId: string, ra: KetQuaDon, that: boolean, max: number
): Promise<number> {
  const dong = await query<DongSoCai>(SQL_SO_CAI_CHUA_XOA, [max]);
  if (dong.length === 0) return 0;

  const xoaDuoc = dong.filter((d) => {
    if (laUrlVideoConNop(d.url)) return true;
    ra.boSot.push({
      assignmentId: d.assignment_id, url: d.url, vi: 'khong-phai-video-con-nop-tren-kho',
    });
    return false;
  });
  if (xoaDuoc.length === 0) return 0;

  if (!that) {
    ra.canhBao.push(`so-cai-con-${xoaDuoc.length}-dong-chua-xoa`);
    return 0;
  }
  return await xoaTheoLo(runId, ra, xoaDuoc, ra.daXoaLai);
}
