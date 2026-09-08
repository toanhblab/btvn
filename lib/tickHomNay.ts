/**
 * Dem "hom nay con bao nhieu viec chua xong" tren man cua con, dung chung cho
 * MOI nhom nhiem vu cua man do (issue #42 dung HAI nhom: "Sau khi hoc xong" va
 * "Viec nha hang ngay").
 *
 * Vi sao phai la mot ham rieng, dung chung: moi nhom la mot instance
 * ViecNhaBai voi state tick lac quan RIENG. Neu moi nhom tu tru tick cua chinh
 * no vao so cua may chu thi nhom nay khong thay tick cua nhom kia — con tick
 * het ca hai nhom lien tuc (truoc khi router.refresh() cua nhom dau kip ve) se
 * khong bao gio duoc day sang man khen /xong. Nen tick cua ca hai nhom nam
 * trong MOT map duy nhat (app/con/[childId]/TickHomNay.tsx giu map do) va so
 * con lai luon tinh tu map day du do.
 *
 * `moc` la trang thai may chu THAY O LAN DUNG TRANG GAN NHAT, chi cua nhung
 * dong CUA HOM NAY (dong cua ngay mai cung hien tren man nhung khong tinh vao
 * so cua hom nay). `todoHomNay` va `moc` phai den tu CUNG mot lan dung trang:
 * du router.refresh() da chay xong (moc moi cho ca hai) hay chua kip (moc cu
 * cho ca hai) thi phep cong tru duoi day van ra dung so.
 */

/** id dong cua HOM NAY -> may chu dang thay dong do la 'done'. */
export type MocHomNay = Record<string, boolean>;

/** id dong -> con vua tick tai cho la xong (true) hay bo tick (false). */
export type TickLacQuan = Record<string, boolean>;

/**
 * So dong 'todo' cua hom nay con lai sau khi ap dung cac tick lac quan.
 *
 * Dong khong co trong `moc` (dong cua ngay khac) bi bo qua: tick no khong lam
 * thay doi so viec cua hom nay.
 */
export function conLaiHomNay(
  todoHomNay: number,
  moc: MocHomNay,
  daTick: TickLacQuan
): number {
  let n = todoHomNay;
  for (const [id, done] of Object.entries(daTick)) {
    const mocDone = moc[id];
    if (mocDone === undefined) continue;
    if (done && !mocDone) n -= 1;
    if (!done && mocDone) n += 1;
  }
  return n;
}
