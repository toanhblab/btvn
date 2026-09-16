/**
 * MOT dinh nghia duy nhat cho "dong nay co nam tren man cua con khong", dung
 * chung cho ca man cua con (ve ra + cho tick) lan moi con so tom tat dan toi man
 * do (`progressUpcoming` -> huy hieu "N viec" o man chon ten, hai o "Hoàn thành"
 * / "Đang chờ" cua bo me). Bat bien o AGENTS.md: tap DEM phai bang tap VE.
 *
 * Luat, hai loai hai kieu:
 *   - Bai tap (choreId null): HOM NAY (xong hay chua deu ve) CONG moi bai CHUA
 *     XONG cua ngay da qua. Bai co han tu NGAY MAI tro di KHONG ve (issue #62,
 *     captain chot): #55 tung keo bai ngay mai len duoi tieu de "Ngày mai" cho
 *     con lam truoc, captain muon man cua con chi noi ve viec cua hom nay va
 *     viec con no — bo me van thay bai ngay mai o man cua ho. Bai cua hom qua
 *     chua lam thi o lai cho toi khi duoc tick, duoi tieu de ngay cua chinh no
 *     (#55): truoc do no BIEN MAT khoi man cua con, khong ai con biet la dang no
 *     bai nao. Bai DA XONG cua ngay da qua van bi loai — xong roi thi khong con
 *     viec gi de lam, giu lai chi lam danh sach dai mai. Bai DA XONG cua HOM NAY
 *     thi VAN ve: tick xong ma bai bien mat la hong mach an mung cua con.
 *   - Nhiem vu hang ngay: CHI HOM NAY. Dong cua ngay mai van duoc tao san
 *     (saveSubmission goi taoNhiemVuNgayNeuChuaQua cho ngay bo me giao bai —
 *     loi goi do con gac +10, xem lib/store.ts) nhung KHONG ve: tick mot dong
 *     nhiem vu la an ⭐ ngay, nen ve dong ngay mai la con bam "Đánh răng buổi
 *     tối" cua mai tu toi nay — ⭐ truoc mot ngay cho viec chua lam, nguoc han
 *     muc dich "ren ky luat va tu giac" cua chinh tinh nang nay. Khong ve cung
 *     khong mat gi: taoNhiemVuNgay chay luoi moi ngay nen sang mai mo man la
 *     co du.
 *
 * `status` chi duoc nhin o MOT cho: quyet dinh giu hay bo mot bai cua ngay DA
 * QUA. Voi hom nay (va voi MOI dong nhiem vu) thi loc BAT KE status, va voi ngay
 * mai thi loai BAT KE status — neu loai dong 'todo' cua ngay mai ma giu dong
 * 'done' (tick qua ma cu truoc khi deploy, hay qua API, hay qua link truc tiep
 * toi bai) thi `total` phinh ma `left` khong doi — "Chưa có bài" / "Xong hết 🎉"
 * lech ngay.
 *
 * Ham thuan, khong import gi luc chay (chi import type) de node --test nap duoc.
 */

import type { Assignment, HwSource, NhomNhiemVu, Status } from './types';

/**
 * Dong nay co nam tren man cua con (duoc VE va cho TICK) hom nay khong?
 *
 * `status` la tham so BAT BUOC (khong mac dinh) co chu y: tu #55 no tham gia
 * luat loc, nen moi noi goi phai tu quyet dinh truyen gi — quen la loi bien dich
 * chu khong phai mot con so lech im lang o mot man nao do.
 */
export function veTrenManCuaCon(
  choreId: string | null,
  dueDate: string,
  today: string,
  status: Status
): boolean {
  if (choreId != null) return dueDate === today;
  if (dueDate === today) return true;
  return dueDate < today && status !== 'done';
}

/** Loc mot danh sach bai/nhiem vu xuong dung nhung dong man cua con ve ra. */
export function dongTrenManCuaCon(items: Assignment[], today: string): Assignment[] {
  return items.filter((a) => veTrenManCuaCon(a.choreId, a.dueDate, today, a.status));
}

/**
 * Thu tu cac NHOM NGAY tren man cua con: hom nay tren cung, roi cac ngay DA QUA
 * lui dan (hom qua truoc, cang cu cang xuong duoi). Tu #62 man cua con khong con
 * ngay nao SAU hom nay (`veTrenManCuaCon`), nen "moi truoc" la du — nhanh xep
 * "ngay sap toi tang dan" cua #55 da bo vi khong con du lieu nao chay vao.
 *
 * Vi sao khong xep ngay qua han len dau du no gap hon: man cua con mo ra la de
 * lam BAI CUA HOM NAY: do la thu con phai xong truoc khi di choi (PRD 4.3). Bai
 * no cu la phan bu them, de duoi cho khoi day thu tu uu tien cua con.
 */
export function soSanhNgayTrenManCuaCon(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

/**
 * Tach cac dong NHIEM VU cua man cua con thanh hai nhom (issue #42 Q1: "Sau khi
 * hoc xong" va "Viec nha hang ngay", khong tron chung mot danh sach).
 *
 * @param nhoms  cac nhom theo dung thu tu muon hien — `Object.keys(NHOM_NHIEM_VU)`.
 *   Nhom DAU TIEN nhan cac dong viec nha cu ma `daily_chores` khong con
 *   (`choreNhom` null), de khong bo roi dong nao con dang 'todo' cua hom nay.
 * @returns cac nhom CO dong, giu nguyen thu tu `nhoms` va thu tu dong trong `items`.
 */
export function nhomNhiemVuHomNay(
  items: Assignment[],
  today: string,
  nhoms: NhomNhiemVu[]
): { nhom: NhomNhiemVu; items: Assignment[] }[] {
  const macDinh = nhoms[0];
  return nhoms
    .map((nhom) => ({
      nhom,
      items: items.filter(
        (a) =>
          a.choreId != null &&
          veTrenManCuaCon(a.choreId, a.dueDate, today, a.status) &&
          (a.choreNhom ?? macDinh) === nhom
      ),
    }))
    .filter((g) => g.items.length > 0);
}

/**
 * Tach cac dong BAI TAP cua man cua con thanh mot nhom cho moi noi giao (moi ma
 * trong HW_SOURCES): con lam xong het bai cua mot noi roi moi sang noi kia, nen
 * moi noi can mot khoi rieng voi tien do rieng. Dong nhiem vu (choreId khong
 * null) bi LOAI khoi day du "source" cua no la gi — chore_id moi la dau hieu
 * that, xem lib/types.ts.
 *
 * @param sources cac noi giao theo dung thu tu muon hien — `Object.keys(HW_SOURCES)`.
 * @returns cac nhom CO dong, giu nguyen thu tu `sources` va thu tu dong ben trong.
 */
export function nhomBaiTheoNoiGiao(
  items: Assignment[],
  sources: HwSource[]
): { source: HwSource; items: Assignment[] }[] {
  return sources
    .map((source) => ({
      source,
      items: items.filter((a) => a.choreId == null && a.source === source),
    }))
    .filter((g) => g.items.length > 0);
}

/**
 * Tien do o dau mot nhom tren man cua con — dem DUNG nhung dong ma than nhom do
 * VE RA, khong hon khong kem (bat bien o AGENTS.md, o pham vi trong mot man):
 *   - nhom BAI TAP ve ca bai con no cua ngay da qua (duoi tieu de ngay cua no)
 *     nen tien do phai tinh ca chung. Neu chi dem hom nay thi con lam xong hai
 *     bai hom nay la dau nhom to xanh + "🎉 2/2 bài xong" trong khi ngay duoi
 *     con ba the bai no chua lam.
 *   - nhom NHIEM VU chi ve dong cua hom nay (`nhomNhiemVuHomNay`) nen tien do
 *     cung chi co dong cua hom nay — dung cung ham nay, khac o tap dua vao.
 */
export function tienDoNhom(items: Assignment[]): { total: number; done: number; xongHet: boolean } {
  const done = items.filter((a) => a.status === 'done').length;
  return { total: items.length, done, xongHet: items.length > 0 && done === items.length };
}
