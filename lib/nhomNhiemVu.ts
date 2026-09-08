/**
 * Chon cac dong nhiem vu hang ngay de VE tren man cua con, tach theo nhom
 * (issue #42 Q1: "Sau khi hoc xong" va "Viec nha hang ngay", khong tron chung).
 *
 * CHI dong cua HOM NAY. Dong cua ngay mai van duoc tao san (saveSubmission goi
 * taoNhiemVuNgay cho ngay bo me giao bai) nhung KHONG duoc ve: dong nhiem vu tick
 * duoc la an sao ngay, nen ve dong ngay mai la con bam "Đánh răng buổi tối" cua
 * mai tu toi nay, an sao truoc mot ngay roi sang mai khong con gi phai lam —
 * nguoc han muc dich "ren ky luat va tu giac" cua chinh tinh nang nay. Dong cua
 * ngay mai cung khong mat gi khi khong ve: taoNhiemVuNgay chay luoi moi ngay nen
 * sang mai mo man la co du.
 *
 * Bai tap thi KHAC — bai cua ngay mai VAN hien (lam bai truoc mot ngay la tot),
 * xem AGENTS.md truc thoi gian.
 *
 * Ham thuan, khong import gi luc chay (chi import type) de node --test nap duoc.
 */

import type { Assignment, NhomNhiemVu } from './types';

/**
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
        (a) => a.choreId != null && a.dueDate === today && (a.choreNhom ?? macDinh) === nhom
      ),
    }))
    .filter((g) => g.items.length > 0);
}
