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
  const family = await getFamilyById(familyId);
  return family?.ngonNgu ?? NGON_NGU_MAC_DINH;
});

/** Ham dich cho server component va route handler. */
export async function chu(): Promise<T> {
  return taoT(await ngonNguHienTai());
}
