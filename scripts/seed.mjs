/**
 * Tao bang va nap du lieu ban dau.
 *   npm run db:seed              -> PIN mac dinh 1234
 *   PARENT_PIN=8520 npm run db:seed
 *
 * Chay lai duoc nhieu lan: xoa sach du lieu cu roi nap lai.
 */

import { readFileSync, mkdirSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const PIN = process.env.PARENT_PIN || '1234';
const SECRET = process.env.PIN_SECRET || 'dev-secret-doi-truoc-khi-deploy';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Cung mot ham query nhu lib/db.ts, viet lai o day vi script chay ngoai Next.
async function makeQuery() {
  if (process.env.DATABASE_URL) {
    const sql = neon(process.env.DATABASE_URL);
    console.log('DB: Neon Postgres');
    return (t, p = []) => sql.query(t, p);
  }
  const { PGlite } = await import('@electric-sql/pglite');
  mkdirSync('./.data/pg', { recursive: true });   // PGlite khong tu tao thu muc cha
  const db = await PGlite.create('./.data/pg');
  console.log('DB: PGlite (local, .data/pg)');
  return async (t, p = []) => (await db.query(t, p)).rows;
}

const id = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const query = await makeQuery();

// 1. Tao bang
for (const stmt of readFileSync('./schema.sql', 'utf8').split(/;\s*$/m)) {
  if (stmt.trim()) await query(stmt);
}
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
  ['Tiếng Việt', '📖', 'Đọc bài trang 10, đọc to cho bố mẹ nghe.', 'Sách Tiếng Việt tập 1', 'vi', '/img/bai-doc-sach.jpg'],
  ['Toán',       '🔢', 'Làm bài 3 trang 34. Viết vào vở ô ly.',    'Trang 34, bài 3',        'vi', '/img/bai-toan-vo-o-ly.jpg'],
  ['Tiếng Anh',  '🔤', 'Learn the colors: red, blue, yellow, green. Say each color out loud three times.', 'Lớp tiếng Anh thứ Ba', 'en', '/img/bai-mau-sac.jpg'],
  ['Vẽ',         '🎨', 'Vẽ ngôi nhà của em, tô màu cho thật đẹp.', 'Giấy A4',                'vi', '/img/bai-ngoi-nha.jpg'],
];

let n = 0;
for (const childId of ['minh', 'an']) {
  for (const [subject, icon, content, note, lang, img] of twinTasks) {
    await query(
      `INSERT INTO assignments (id, submission_id, child_id, subject, icon, content, note, lang, due_date, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id('asg'), subId, childId, subject, icon, content, note, lang, dateOffset(0), img]
    );
    n++;
  }
}

// Mot bai qua han cua Minh de thu trang thai "Qua han" tren bang dieu khien
await query(
  `INSERT INTO assignments (id, submission_id, child_id, subject, icon, content, note, lang, due_date, image_url)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
  [id('asg'), null, 'minh', 'Tự nhiên', '🐝', 'Quan sát con ong, kể lại cho cô nghe.', null, 'vi', dateOffset(-1), '/img/bai-con-ong.jpg']
);
n++;

// Be Na: hom nay KHONG co bai -> dung de thu man "Hom nay khong co bai tap"
await query(
  `INSERT INTO assignments (id, submission_id, child_id, subject, icon, content, note, lang, due_date, image_url)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
  [id('asg'), null, 'bena', 'Tiếng Anh', '🔤', 'Point at the picture and say: cat, dog, bird.', 'Bài của lớp tiếng Anh', 'en', dateOffset(1), '/img/bai-con-ong.jpg']
);
n++;

console.log(`✓ 1 gia đình, ${children.length} con, ${n} bài tập`);
console.log(`  PIN bố mẹ : ${PIN}`);
console.log(`  slug       : ${slug}`);
process.exit(0);
