/**
 * Mot lop truy cap DB duy nhat cho ca hai moi truong:
 *   - Co DATABASE_URL  -> Neon Postgres (production tren Vercel)
 *   - Khong co          -> PGlite, Postgres nhung chay ngay trong process,
 *                          luu vao .data/pg (chi dung khi dev)
 *
 * Ca hai deu la Postgres that nen SQL viet mot lan dung duoc ca hai. Doi sang
 * Neon chi la them bien moi truong, khong phai sua code.
 */

import { neon } from '@neondatabase/serverless';

export const hasNeon = Boolean(process.env.DATABASE_URL);

type Row = Record<string, unknown>;
type Pg = { query: (t: string, p?: unknown[]) => Promise<{ rows: Row[] }> };

/**
 * PGlite phai la MOT instance duy nhat cho ca process.
 *
 * Next dong goi server component va route handler thanh hai module graph khac
 * nhau, nen neu giu bien o pham vi module thi moi ben se mo mot PGlite rieng
 * tren cung thu muc. Moi ben co bo nho dem rieng => bo me luu bai xong ma trang
 * kia van hien so cu. Ghim vao globalThis de ca hai dung chung mot instance.
 *
 * Neon khong dinh van de nay vi do la server that, dung chung san.
 */
const g = globalThis as typeof globalThis & { __btvnPglite?: Promise<Pg> };

function getPglite(): Promise<Pg> {
  g.__btvnPglite ??= (async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const { mkdirSync } = await import('node:fs');
    mkdirSync('./.data/pg', { recursive: true });   // PGlite khong tu tao thu muc cha
    return (await PGlite.create('./.data/pg')) as unknown as Pg;
  })();
  return g.__btvnPglite;
}

/** Chay mot cau SQL co tham so ($1, $2...). Tra ve mang ban ghi. */
export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (hasNeon) {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql.query(text, params);
    return rows as T[];
  }
  const db = await getPglite();
  const res = await db.query(text, params);
  return res.rows as T[];
}

/** Tien ich cho cau chi tra ve mot dong (hoac khong dong nao). */
export async function queryOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
