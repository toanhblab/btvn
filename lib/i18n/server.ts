import { cache } from 'react';
import { viewingFamilyId } from '../auth';
import { getFamilyById } from '../store';
import { taoT, type T } from './chu';
import { NGON_NGU_MAC_DINH, type NgonNgu } from './ngonNgu';

/**
 * Ngon ngu cua NHA DANG MO tren may nay — phien bo me neu co, khong thi nha gan
 * voi thiet bi (cung uu tien voi viewingFamilyId). May chua gan nha nao (lan
 * dau mo /vao, /bome/pin) thi tieng Viet.
 *
 * `cache` cua React: moi request chi doc DB mot lan du layout, page va cac
 * component con deu goi.
 */
export const ngonNguHienTai = cache(async (): Promise<NgonNgu> => {
  const familyId = await viewingFamilyId();
  if (!familyId) return NGON_NGU_MAC_DINH;
  try {
    const family = await getFamilyById(familyId);
    return family?.ngonNgu ?? NGON_NGU_MAC_DINH;
  } catch {
    // Layout GOC goi ham nay, nen mot loi DB thoang qua se thanh 500 cho MOI trang
    // — ke ca /vao, /bome/pin, /bome/tao-nha la nhung man khong can du lieu gi.
    // Chi boc rieng loi goi DB: `viewingFamilyId` doc cookie, nuot loi cua no la
    // pha mat duong bail-out khi Next dung san trang /_not-found.
    return NGON_NGU_MAC_DINH;
  }
});

/** Ham dich cho server component va route handler. */
export async function chu(): Promise<T> {
  return taoT(await ngonNguHienTai());
}
