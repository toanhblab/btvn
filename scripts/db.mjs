/**
 * Ket noi DB va bo chay migration cho cac script chay ngoai Next.
 *
 * Dung boi scripts/migrate.mjs (chay khi build) va scripts/seed.mjs.
 *
 * Vi sao khong dung lib/db.ts: file do la TypeScript va doc cookie/env theo kieu
 * cua Next. Script node chay truoc khi co Next nen giu mot lop mong rieng — doi
 * lai la hai noi phai cung doc DATABASE_URL giong nhau.
 */

import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const THU_MUC = './migrations';

/** Cung thu tu bien nhu lib/db.ts — doi mot ben la phai doi ben kia. */
export const CONN =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

/**
 * @returns {Promise<{ ten: string, query: (t: string, p?: unknown[]) => Promise<any[]>,
 *                     chayGoi: (cauLenh: {sql: string, params?: unknown[]}[]) => Promise<void> }>}
 *
 * chayGoi chay ca goi cau lenh trong MOT transaction: mot migration hoac vao het,
 * hoac khong vao gi. Neon HTTP khong co transaction tuong tac nhung co
 * sql.transaction() gui ca goi trong mot luot, dung duoc cho viec nay.
 */
export async function moKetNoi() {
  if (CONN) {
    const sql = neon(CONN);
    return {
      ten: 'Neon Postgres',
      query: (t, p = []) => sql.query(t, p),
      chayGoi: async (cauLenh) => {
        await sql.transaction((txn) => cauLenh.map((c) => txn.query(c.sql, c.params ?? [])));
      },
    };
  }

  // Tren Vercel thi KHONG duoc lui ve PGlite: dia chi doc, va moi lan build lai la
  // mot dia moi nen migration se khong di den dau. Bao dung benh (nhu lib/db.ts).
  if (process.env.VERCEL) {
    throw new Error(
      'Thieu DATABASE_URL khi build tren Vercel nen khong chay duoc migration. Vao ' +
      'Settings > Environment Variables, them DATABASE_URL cua Neon cho ca ' +
      'Production va Preview, roi Redeploy.'
    );
  }

  const { PGlite } = await import('@electric-sql/pglite');
  mkdirSync('./.data/pg', { recursive: true });   // PGlite khong tu tao thu muc cha
  const db = await PGlite.create('./.data/pg');
  return {
    ten: 'PGlite (local, .data/pg)',
    query: async (t, p = []) => (await db.query(t, p)).rows,
    chayGoi: async (cauLenh) => {
      await db.query('BEGIN');
      try {
        for (const c of cauLenh) await db.query(c.sql, c.params ?? []);
        await db.query('COMMIT');
      } catch (err) {
        await db.query('ROLLBACK');
        throw err;
      }
    },
  };
}

/**
 * Tach mot tep .sql thanh tung cau lenh.
 *
 * Neon HTTP chi nhan MOT cau lenh moi luot nen buoc phai tach. Cach tach la tho:
 * cat o dau ";" cuoi dong. Du cho DDL binh thuong, nhung dung viet thu than
 * ($$ ... $$) trong migration vi trong do co the co dau ";".
 */
function tachCauLenh(noiDung) {
  return noiDung
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function danhSachMigration() {
  return readdirSync(THU_MUC).filter((f) => f.endsWith('.sql')).sort();
}

/**
 * Chay nhung migration chua chay, theo thu tu ten tep.
 *
 * Bang _migrations ghi nhung tep da chay. Ghi TRONG cung transaction voi cac cau
 * lenh cua tep do, nen khong bao gio co chuyen "chay roi ma khong ghi" hay nguoc
 * lai — tru khi ban sua noi dung mot tep da chay, viec ma khong duoc lam: da chay
 * roi thi them tep moi, dung sua tep cu.
 *
 * @returns {Promise<string[]>} ten cac tep vua chay
 */
export async function chayMigrations(db, { log = () => {} } = {}) {
  await db.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name       TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );

  const daChay = new Set((await db.query(`SELECT name FROM _migrations`)).map((r) => r.name));
  const vuaChay = [];

  for (const ten of danhSachMigration()) {
    if (daChay.has(ten)) continue;

    const cauLenh = tachCauLenh(readFileSync(join(THU_MUC, ten), 'utf8'))
      .map((sql) => ({ sql }));
    cauLenh.push({ sql: `INSERT INTO _migrations (name) VALUES ($1)`, params: [ten] });

    try {
      await db.chayGoi(cauLenh);
    } catch (err) {
      throw new Error(`Migration ${ten} loi: ${err instanceof Error ? err.message : err}`, {
        cause: err,
      });
    }

    vuaChay.push(ten);
    log(`  + ${ten}`);
  }

  return vuaChay;
}
