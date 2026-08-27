/**
 * Tao bang va nap du lieu mau de DEV — xoa sach du lieu cu truoc khi nap.
 *   npm run db:seed              -> PIN mac dinh 1234
 *   PARENT_PIN=8520 npm run db:seed
 *
 * CANH BAO: tu khi app dung cho nhieu gia dinh, "xoa sach" nghia la xoa CA CAC
 * NHA CUA BAN BE. Nen khi co DATABASE_URL (tuc la dang tro vao DB that) thi
 * script tu chan lai, phai them --force moi chay. Muon nang DB that len ban moi
 * ma giu du lieu thi dung scripts/migrate.mjs.
 */

import { chayMigrations, moKetNoi, CONN } from './db.mjs';

const FORCE = process.argv.includes('--force');
if (CONN && !FORCE) {
  console.error('✗ Dang tro vao DATABASE_URL that. Seed se XOA HET moi gia dinh trong DB do.');
  console.error('  Muon nang DB len ban moi ma giu du lieu : node scripts/migrate.mjs');
  console.error('  Van muon xoa sach va nap lai du lieu mau: npm run db:seed -- --force');
  process.exit(1);
}

const PIN = process.env.PARENT_PIN || '1234';
const SECRET = process.env.PIN_SECRET || 'dev-secret-doi-truoc-khi-deploy';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const id = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const db = await moKetNoi();
const query = db.query;
console.log(`DB: ${db.ten}`);

// 1. Tao bang — dung chung bo migration voi ban that, khong ta lai luoc do o day
await chayMigrations(db);
console.log('✓ Da tao bang');

// 2. Xoa du lieu cu
for (const t of ['assignments', 'submission_images', 'submissions', 'children', 'families']) {
  await query(`DELETE FROM ${t}`);
}

// 3. Gia dinh — slug ngau nhien lam duong dan kho doan (PRD muc 10)
const familyId = id('fam');
const slug = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
await query(
  `INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ($1,$2,$3,$4)`,
  [familyId, 'Nhà mình', slug, await sha256(`${SECRET}:${PIN}`)]
);

// 4. Ba con — dung PRD muc 11: 2 be sinh doi lop 1 + 1 be 4 tuoi mau giao.
//    Moi be mot mau rieng vi hai be sinh doi chua doc thao ten.
const children = [
  { id: 'minh', name: 'Minh',   color: 'primary',   avatar: '/img/avatar-minh.jpg', grade: 'Lớp 1'    , order: 1 },
  { id: 'an',   name: 'An',     color: 'secondary', avatar: '/img/avatar-an.jpg',   grade: 'Lớp 1'    , order: 2 },
  { id: 'bena', name: 'Bé Na',  color: 'tertiary',  avatar: '/img/avatar-bena.jpg', grade: 'Mẫu giáo' , order: 3 },
];
for (const c of children) {
  await query(
    `INSERT INTO children (id, family_id, name, avatar_url, color, grade, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [c.id, familyId, c.name, c.avatar, c.color, c.grade, c.order]
  );
}

// 5. Bai tap mau — mot submission ra bai cho CA HAI be sinh doi (truong hop
//    dung nhieu nhat theo PRD 4.2). Be Na co bai rieng cua lop tieng Anh.
const subId = id('sub');
await query(`INSERT INTO submissions (id, family_id, raw_text) VALUES ($1,$2,$3)`,
  [subId, familyId, 'Bài tập cô giao trên Zalo']);

const twinTasks = [
  ['Tiếng Việt', '📖', 'Đọc bài trang 10, đọc to cho bố mẹ nghe.', 'Sách Tiếng Việt tập 1', 'vi', 'primary_school', '/img/bai-doc-sach.jpg'],
  ['Toán',       '🔢', 'Làm bài 3 trang 34. Viết vào vở ô ly.',    'Trang 34, bài 3',        'vi', 'primary_school', '/img/bai-toan-vo-o-ly.jpg'],
  ['Tiếng Anh',  '🔤', 'Learn the colors: red, blue, yellow, green. Say each color out loud three times.', 'Lớp tiếng Anh thứ Ba', 'en', 'english_class', '/img/bai-mau-sac.jpg'],
  ['Vẽ',         '🎨', 'Vẽ ngôi nhà của em, tô màu cho thật đẹp.', 'Giấy A4',                'vi', 'primary_school', '/img/bai-ngoi-nha.jpg'],
];

let n = 0;
for (const childId of ['minh', 'an']) {
  for (const [subject, icon, content, note, lang, source, img] of twinTasks) {
    await query(
      `INSERT INTO assignments (id, submission_id, child_id, subject, icon, content, note, lang, source, due_date, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id('asg'), subId, childId, subject, icon, content, note, lang, source, dateOffset(0), img]
    );
    n++;
  }
}

// Mot bai qua han cua Minh de thu trang thai "Qua han" tren bang dieu khien
await query(
  `INSERT INTO assignments (id, submission_id, child_id, subject, icon, content, note, lang, source, due_date, image_url)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
  [id('asg'), null, 'minh', 'Tự nhiên', '🐝', 'Quan sát con ong, kể lại cho cô nghe.', null, 'vi', 'primary_school', dateOffset(-1), '/img/bai-con-ong.jpg']
);
n++;

// Be Na: hom nay KHONG co bai -> dung de thu man "Hom nay khong co bai tap"
await query(
  `INSERT INTO assignments (id, submission_id, child_id, subject, icon, content, note, lang, source, due_date, image_url)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
  [id('asg'), null, 'bena', 'Tiếng Anh', '🔤', 'Point at the picture and say: cat, dog, bird.', 'Bài của lớp tiếng Anh', 'en', 'english_class', dateOffset(1), '/img/bai-con-ong.jpg']
);
n++;

console.log(`✓ 1 gia đình, ${children.length} con, ${n} bài tập`);
console.log(`  PIN bố mẹ      : ${PIN}`);
console.log(`  Link cho iPad  : /nha/${slug}`);
process.exit(0);
