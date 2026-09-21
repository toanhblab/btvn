/**
 * Xac thuc cua nhan bai tu Zalo — MOT ban dung chung cho ca hai route
 * (`POST /api/nhan-bai-zalo` va `GET /api/nhan-bai-zalo/cau-hinh`).
 *
 * Cung khuon voi `/api/don-video` (CRON_SECRET): khoa nam trong bien moi truong,
 * gui qua `Authorization: Bearer <...>`. KHONG dung chung CRON_SECRET — hai ben
 * goi la hai he khac nhau (cron cua Vercel vs mot tien trinh tren Mac mini
 * trong nha), lo mot khoa khong duoc keo theo cai kia.
 *
 * BA trang thai, va chung KHONG duoc gop:
 *
 *   503 — MAY CHU chua co khoa. Day la loi cua ban deploy, khong phai cua nguoi
 *         goi: gop no vao 401 thi zalo-agent se bao "sai khoa" va captain di
 *         soi Keychain trong khi loi that nam o Vercel. `/api/don-video` gop
 *         hai cai nay (401 cho ca hai) va chu thich o man Cai dat ke lai dung
 *         cai gia do: "mot ban deploy thieu CRON_SECRET tra 401 moi dem nen
 *         khong dong nao duoc ghi bao gio" — khong lap lai o day.
 *   401 — thieu hoac sai khoa. KHONG noi la cai nao: ai do do khoa thi moi bit
 *         thong tin deu la mot bac de hon.
 *   ok  — qua.
 *
 * So sanh bang `timingSafeEqual` tren ban bam SHA-256 cua hai chuoi: so sanh
 * `===` tren chuoi tra ve som o ky tu dau tien khac nhau. Bam truoc de hai ben
 * luon cung do dai (timingSafeEqual nem loi khi lech do dai — va chinh viec nem
 * do lai lo do dai khoa).
 */

import { createHash, timingSafeEqual } from 'node:crypto';

export type KetQuaXacThuc = { ok: true } | { ok: false; status: 401 | 503; loi: string };

const bam = (s: string): Buffer => createHash('sha256').update(s, 'utf8').digest();

export function xacThucZalo(req: Request): KetQuaXacThuc {
  const secret = process.env.ZALO_INTAKE_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 503,
      loi: 'chua-dat-ZALO_INTAKE_SECRET',
    };
  }
  const header = req.headers.get('authorization') ?? '';
  const ok = header.startsWith('Bearer ') &&
    timingSafeEqual(bam(header.slice('Bearer '.length)), bam(secret));
  return ok ? { ok: true } : { ok: false, status: 401, loi: 'unauthorized' };
}
