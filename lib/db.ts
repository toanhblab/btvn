/**
 * Mot lop truy cap DB duy nhat cho ca hai moi truong:
 *   - Co chuoi ket noi -> Neon Postgres (production tren Vercel)
 *   - Khong co          -> PGlite, Postgres nhung chay ngay trong process,
 *                          luu vao .data/pg. CHI dung khi dev tren may that;
 *                          tren Vercel thi bao loi thay vi lui ve day.
 *
 * Ca hai deu la Postgres that nen SQL viet mot lan dung duoc ca hai. Doi sang
 * Neon chi la them bien moi truong, khong phai sua code.
 */

import { neon } from '@neondatabase/serverless';

/**
 * Tuy tich hop ma Vercel dat ten bien khac nhau: dung Neon truc tiep thi ra
 * DATABASE_URL, qua Marketplace/Postgres thi co khi lai la POSTGRES_URL. Nhan
 * ca may ten cho khoi phai doi ten tay tren bang dieu khien.
 */
const CONN =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

export const hasNeon = Boolean(CONN);

/**
 * Tren Vercel thi KHONG duoc phep lui ve PGlite.
 *
 * Serverless co dia chi doc, nen PGlite se chet voi "ENOENT: mkdir './.data/pg'"
 * — mot loi khong he goi y rang nguyen nhan that la thieu bien moi truong. Chan
 * ngay tu day de bao dung benh. Va du co ghi duoc di nua thi moi lan goi ham lai
 * la mot dia moi, du lieu bo me nhap se bien mat.
 */
if (process.env.VERCEL && !CONN) {
  throw new Error(
    'Thieu DATABASE_URL tren Vercel. Vao Settings > Environment Variables, them ' +
    'DATABASE_URL cua Neon cho moi truong Production, roi Redeploy (doi bien xong ' +
    'phai deploy lai thi ban dang chay moi nhan duoc).'
  );
}

type Row = Record<string, unknown>;
type Pg = {
  query: (t: string, p?: unknown[]) => Promise<{ rows: Row[] }>;
  transaction: <T>(fn: (tx: { query: Pg['query'] }) => Promise<T>) => Promise<T>;
};

/** Mot cau trong goi transaction cua queryTx. */
export interface CauSQL { sql: string; params?: unknown[] }

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

/**
 * Thu muc PGlite: mac dinh ./.data/pg (DB dev). Test PGlite import thang
 * lib/store.ts (lib/nha-demo.test.ts) dat BTVN_PGLITE_DIR sang thu muc tam de
 * KHONG dung vao DB dev; `memory://` la DB trong RAM.
 */
const PGLITE_DIR = process.env.BTVN_PGLITE_DIR || './.data/pg';

function getPglite(): Promise<Pg> {
  g.__btvnPglite ??= (async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    if (!PGLITE_DIR.startsWith('memory://')) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(PGLITE_DIR, { recursive: true });   // PGlite khong tu tao thu muc cha
    }
    return (await PGlite.create(PGLITE_DIR)) as unknown as Pg;
  })();
  return g.__btvnPglite;
}

/** Chay mot cau SQL co tham so ($1, $2...). Tra ve mang ban ghi. */
export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (hasNeon) {
    const sql = neon(CONN);
    const rows = await sql.query(text, params);
    return rows as T[];
  }
  const db = await getPglite();
  const res = await db.query(text, params);
  return res.rows as T[];
}

/**
 * Chay ca goi cau lenh trong MOT transaction, theo thu tu, tra ve ket qua tung cau.
 *
 * Moi cau qua `query` la mot request rieng, tu commit — du cho hau het app vi
 * tung cau da duoc viet de tu no dung (ON CONFLICT, UPDATE co dieu kien...).
 * Tru diem (issue #43) thi khong: phai KHOA theo con roi moi INSERT co kiem so du,
 * va khoa chi co nghia khi hai cau nam trong cung mot transaction (xem
 * lib/sqlDiem.ts). Neon HTTP co sql.transaction() gui ca goi trong mot luot
 * (khong tuong tac — khong doc ket qua cau truoc de quyet cau sau duoc, nen goi
 * phai la danh sach co dinh); PGlite co db.transaction() tu xep hang cac
 * transaction dong thoi. Cung mot khuon voi chayGoi trong scripts/db.mjs.
 */
export async function queryTx<T = Row>(cauLenh: CauSQL[]): Promise<T[][]> {
  if (hasNeon) {
    const sql = neon(CONN);
    const ketQua = await sql.transaction(cauLenh.map((c) => sql.query(c.sql, c.params ?? [])));
    return ketQua as unknown as T[][];
  }
  const db = await getPglite();
  return db.transaction(async (tx) => {
    const ketQua: T[][] = [];
    for (const c of cauLenh) ketQua.push((await tx.query(c.sql, c.params ?? [])).rows as T[]);
    return ketQua;
  });
}

/** Tien ich cho cau chi tra ve mot dong (hoac khong dong nao). */
export async function queryOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
