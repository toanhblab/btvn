/**
 * Chay cac migration chua chay. KHONG xoa du lieu nao.
 *
 *   npm run db:migrate                    -> DB local (PGlite) neu khong co bien
 *   DATABASE_URL=... npm run db:migrate   -> DB that
 *
 * Chay lai bao nhieu lan cung duoc: bang _migrations ghi nhung tep da chay.
 *
 * Script nay nam trong lenh "build" nen Vercel tu chay moi lan deploy. Muon deploy
 * ma khong chay migration thi dat SKIP_MIGRATIONS=1.
 *
 * Them thay doi lươc do: tao tep moi trong migrations/ (so tang dan), DUNG sua tep
 * cu — tep cu da chay o DB that roi, sua no thi khong ai chay lai nua.
 */

import { chayMigrations, danhSachMigration, moKetNoi, CONN } from './db.mjs';

if (process.env.SKIP_MIGRATIONS === '1') {
  console.log('↷ Bo qua migration (SKIP_MIGRATIONS=1)');
  process.exit(0);
}

let db;
try {
  db = await moKetNoi();
} catch (err) {
  // Hay gap nhat: build tren Vercel ma quen dat DATABASE_URL. Bao thang loi cua
  // moKetNoi chu khong de Node in stack trace — doc stack khong ra benh.
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
console.log(`DB: ${db.ten}`);

let vuaChay;
try {
  vuaChay = await chayMigrations(db, { log: (m) => console.log(m) });
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);

  // Loi duy nhat co the gap khi nang mot DB dang chay that: hai nha da trung PIN
  // tu truoc khi co rang buoc. Bao ro thay vi de doc loi Postgres.
  if (/families_pin_idx|duplicate key|unique/i.test(msg)) {
    try {
      const dups = await db.query(
        `SELECT parent_pin_hash, COUNT(*) AS n FROM families
         GROUP BY parent_pin_hash HAVING COUNT(*) > 1`
      );
      if (dups.length) {
        console.error('\n✗ Khong tao duoc rang buoc "moi nha mot PIN".');
        console.error(`  Co ${dups.length} ma PIN dang bi nhieu nha dung chung.`);
        console.error('  Vao DB doi PIN cua cac nha do cho khac nhau roi chay lai.\n');
      }
    } catch { /* khong tra duoc thi thoi, van nem loi goc ben duoi */ }
  }

  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (vuaChay.length === 0) {
  console.log(`✓ DB da moi nhat (${danhSachMigration().length} migration)`);
} else {
  console.log(`✓ Da chay ${vuaChay.length} migration moi`);
}

// Chi tom tat duoc khi bang da ton tai — voi DB trong hoan toan thi cung da co sau
// khi chay 001 nen an toan.
const [{ n: families }] = await db.query(`SELECT COUNT(*) AS n FROM families`);
const [{ n: children }] = await db.query(`SELECT COUNT(*) AS n FROM children`);
const [{ n: assignments }] = await db.query(`SELECT COUNT(*) AS n FROM assignments`);
console.log(`  ${families} gia đình · ${children} con · ${assignments} bài tập`);

if (CONN) {
  const rows = await db.query(`SELECT name, slug FROM families ORDER BY created_at ASC`);
  for (const r of rows) console.log(`  · ${r.name} — link cho iPad: /nha/${r.slug}`);
}

process.exit(0);
