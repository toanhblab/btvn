/**
 * MOT dinh nghia duy nhat cho "dong nay co nam tren man cua con khong", dung
 * chung cho ca man cua con (ve ra + cho tick) lan moi con so tom tat dan toi man
 * do (`progressUpcoming` -> huy hieu "N viec" o man chon ten, hai o "Hoàn thành"
 * / "Đang chờ" cua bo me). Bat bien o AGENTS.md: tap DEM phai bang tap VE.
 *
 * Luat, hai loai hai kieu:
 *   - Bai tap (choreId null): TU HOM NAY TRO DI. Bo me hay nhap bai toi hom
 *     truoc cho hom sau, con lam bai truoc mot ngay la tot — man cua con ve bai
 *     ngay mai duoi tieu de "Ngày mai" va cho lam, nen phai dem.
 *   - Nhiem vu hang ngay: CHI HOM NAY. Dong cua ngay mai van duoc tao san
 *     (saveSubmission goi taoNhiemVuNgay cho ngay bo me giao bai — loi goi do
 *     con gac +10, xem lib/store.ts) nhung KHONG ve: tick mot dong nhiem vu la
 *     an ⭐ ngay, nen ve dong ngay mai la con bam "Đánh răng buổi tối" cua mai
 *     tu toi nay — ⭐ truoc mot ngay cho viec chua lam, nguoc han muc dich "ren
 *     ky luat va tu giac" cua chinh tinh nang nay. Khong ve cung khong mat gi:
 *     taoNhiemVuNgay chay luoi moi ngay nen sang mai mo man la co du.
 *
 * Loc BAT KE status: neu chi loai dong 'todo' cua ngay mai ma giu dong 'done'
 * (tick qua ma cu truoc khi deploy, hay qua API) thi `total` phinh ma `left`
 * khong doi — "Chưa có bài" / "Xong hết 🎉" lech ngay.
 *
 * Ham thuan, khong import gi luc chay (chi import type) de node --test nap duoc.
 */

import type { Assignment, NhomNhiemVu } from './types';

/** Dong nay co nam tren man cua con (duoc VE va cho TICK) hom nay khong? */
export function veTrenManCuaCon(
  choreId: string | null,
  dueDate: string,
  today: string
): boolean {
  return choreId == null ? dueDate >= today : dueDate === today;
}

/** Loc mot danh sach bai/nhiem vu xuong dung nhung dong man cua con ve ra. */
export function dongTrenManCuaCon(items: Assignment[], today: string): Assignment[] {
  return items.filter((a) => veTrenManCuaCon(a.choreId, a.dueDate, today));
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
          veTrenManCuaCon(a.choreId, a.dueDate, today) &&
          (a.choreNhom ?? macDinh) === nhom
      ),
    }))
    .filter((g) => g.items.length > 0);
}
