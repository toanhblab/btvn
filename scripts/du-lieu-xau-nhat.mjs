/**
 * Boi DB dev thanh DU LIEU XAU NHAT truoc khi chup anh bo cuc (AGENTS.md).
 *
 * `npm run db:seed` nap trang thai DE NHAT: 3 con, ten ngan, 0 ⭐ — anh chup
 * tren do khong chung minh duoc gi ve bo cuc. Script nay doi lai cho dung dieu
 * kien AGENTS.md doi: ⭐ BA CHU SO, ten con DAI, va NHIEU HON 3 con (hang chon
 * ten con va bang xep hang chi vo khi du the de tran).
 *
 *   node scripts/du-lieu-xau-nhat.mjs
 *
 * CHI dung cho DB dev (PGlite). Tu choi khi co DATABASE_URL — day la script
 * lam xau du lieu, khong bao gio duoc cham vao DB that.
 *
 * Chay xong PHAI khoi dong lai `next dev`: PGlite nap ca ./.data/pg vao bo nho
 * luc mo, nen ghi trong khi may chu dang chay KHONG hien len trang (AGENTS.md).
 */
import { moKetNoi, CONN } from './db.mjs';

if (CONN) {
  console.error('✗ Dang tro vao DATABASE_URL. Script nay chi cho DB dev (PGlite).');
  process.exit(1);
}

const db = await moKetNoi();
const q = db.query;

const [{ id: familyId }] = await q(`SELECT id FROM families ORDER BY id LIMIT 1`);

// 1. Ten con DAI — header man con va the con o man bo me phai chiu duoc
const tenDai = {
  minh: 'Nguyễn Hoàng Minh Khôi',
  an: 'Nguyễn Hoàng Bảo Anh',
  bena: 'Nguyễn Hoàng Bảo Na',
};
for (const [id, ten] of Object.entries(tenDai)) {
  await q(`UPDATE children SET name = $2 WHERE id = $1`, [id, ten]);
}

// 2. Con THU TU — hang chon ten con va bang xep hang chi tran khi du the (#63)
await q(
  `INSERT INTO children (id, family_id, name, avatar_url, color, grade, sort_order)
   VALUES ('khoi', $1, 'Nguyễn Hoàng Gia Khánh', '/img/avatar-bena.jpg', 'tertiary', 'Mẫu giáo', 4)
   ON CONFLICT (id) DO NOTHING`,
  [familyId]
);
// Con thu tu hoc cung lop voi be nho -> gan vao nguon Zalo thu hai
await q(
  `INSERT INTO nguon_zalo_con (nguon_id, child_id) VALUES ('nzl_starters', 'khoi')
   ON CONFLICT DO NOTHING`
);

// 3. ⭐ BA CHU SO — vien "Đổi thưởng" o man con rong nhat, the con o man bo me
//    phai chua duoc con so day. Ghi bang score_events 'day_complete' cho nhung
//    ngay da qua (dung bang ma app cong diem, khong bia mot duong rieng).
for (const [childId, soNgay] of [['minh', 42], ['an', 37], ['bena', 15], ['khoi', 11]]) {
  for (let i = 1; i <= soNgay; i++) {
    await q(
      `INSERT INTO score_events (id, child_id, kind, points, event_date)
       VALUES ($1, $2, 'day_complete', 10, CURRENT_DATE - $3::int)
       ON CONFLICT DO NOTHING`,
      [`sev_xau_${childId}_${i}`, childId, i]
    );
  }
}

const diem = await q(
  `SELECT c.name, COALESCE(SUM(e.points), 0) AS d
     FROM children c LEFT JOIN score_events e ON e.child_id = c.id
    WHERE c.family_id = $1 GROUP BY c.id, c.name ORDER BY c.sort_order`,
  [familyId]
);
console.log('✓ Du lieu xau nhat:');
for (const r of diem) console.log(`  ${r.name}: ${r.d} ⭐`);
console.log('  Nho KHOI DONG LAI next dev (PGlite nap DB vao bo nho luc mo).');
process.exit(0);
