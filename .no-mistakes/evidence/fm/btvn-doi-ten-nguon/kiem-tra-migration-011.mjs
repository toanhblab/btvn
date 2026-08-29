/**
 * Kiem chung migration 011_nguon_khac.sql tren PGlite that, qua CHINH bo chay
 * migration cua repo (scripts/db.mjs -> chayMigrations).
 *
 * Ba tinh huong:
 *   A. Co moc _migrations cua 010 -> chi bai tao TRUOC 010 va dang mang mac dinh
 *      'primary_school' moi chuyen sang 'other'.
 *   B. Khong tim thay moc 010 -> KHONG doi gi ca.
 *   C. DB moi tinh, chay het migration 001..011 -> khong loi.
 */
import { mkdtempSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = process.env.REPO_DIR;
const { chayMigrations } = await import(join(REPO, 'scripts/db.mjs'));
const { PGlite } = await import(join(REPO, 'node_modules/@electric-sql/pglite/dist/index.js'));

const MIGS = join(REPO, 'migrations');
const TRUOC_010 = ['001_khoi_tao.sql','002_moi_nha_mot_pin.sql','003_video_dinh_kem.sql',
  '004_video_thu_tu.sql','005_dinh_kem_moi_loai.sql','007_thoi_luong_bai.sql','008_nop_video.sql'];

function moiThuMuc(tep) {
  const root = mkdtempSync(join(tmpdir(), 'btvn-mig-'));
  mkdirSync(join(root, 'migrations'));
  for (const t of tep) cpSync(join(MIGS, t), join(root, 'migrations', t));
  return root;
}
function themTep(root, tep) { for (const t of tep) cpSync(join(MIGS, t), join(root, 'migrations', t)); }

async function moPGlite(root) {
  const db = await PGlite.create(join(root, 'pg'));
  return { db, query: async (t, p = []) => (await db.query(t, p)).rows,
    chayGoi: async (cs) => { await db.query('BEGIN');
      try { for (const c of cs) await db.query(c.sql, c.params ?? []); await db.query('COMMIT'); }
      catch (e) { await db.query('ROLLBACK'); throw e; } } };
}

const BAI = [
  // [id, submission, mon, lang, mo ta, ky vong sau 011]
  ['asg_cu_toan',   'cu',   'Toán',      'vi', 'Bài tạo TRƯỚC 010, mang mặc định primary_school', 'other'],
  ['asg_cu_viet',   'cu',   'Tiếng Việt','vi', 'Bài tạo TRƯỚC 010, mang mặc định primary_school', 'other'],
  ['asg_cu_anh',    'cu',   'Tiếng Anh', 'en', 'Bài tạo TRƯỚC 010, được 010 gán english_class',   'english_class'],
  ['asg_moi_toan',  'moi',  'Toán',      'vi', 'Bài tạo SAU 010, bố mẹ/AI đã chọn primary_school','primary_school'],
  ['asg_moi_anh',   'moi',  'Tiếng Anh', 'en', 'Bài tạo SAU 010, nguồn english_class',            'english_class'],
  ['asg_mo_coi',    null,   'Vẽ',        'vi', 'Bài MẤT submission (ON DELETE SET NULL)',         'primary_school'],
];

async function dungDuLieu(q, { chuaMoc = false } = {}) {
  await q(`INSERT INTO families (id,name,slug,parent_pin_hash) VALUES ('fam1','Nhà mình','slug1','h')`);
  await q(`INSERT INTO children (id,family_id,name,avatar_url,color,grade) VALUES ('minh','fam1','Minh','/a.jpg','primary','Lớp 1')`);
  // Dot nhap CU: created_at truoc khi 010 chay
  await q(`INSERT INTO submissions (id,family_id,raw_text,created_at) VALUES ('sub_cu','fam1','Bài cũ', now() - interval '30 days')`);
  for (const [id, sub, mon, lang] of BAI.filter((b) => b[1] === 'cu' || b[1] === null)) {
    await q(`INSERT INTO assignments (id,submission_id,child_id,subject,content,lang,due_date)
             VALUES ($1,$2,'minh',$3,'Nội dung bài',$4,CURRENT_DATE)`,
      [id, sub === 'cu' ? 'sub_cu' : null, mon, lang]);
  }
}

async function inBang(q, tieuDe) {
  const rows = await q(`SELECT a.id, a.subject, a.source, s.created_at AS sub_at
                          FROM assignments a LEFT JOIN submissions s ON s.id = a.submission_id
                         ORDER BY a.id`);
  const moc = await q(`SELECT applied_at FROM _migrations WHERE name = '010_nguon_bai_tap.sql'`);
  console.log(`\n${tieuDe}`);
  console.log(`  mốc _migrations của 010: ${moc.length ? moc[0].applied_at.toISOString() : '(KHÔNG CÓ)'}`);
  console.log('  ' + 'id'.padEnd(14) + 'môn'.padEnd(12) + 'source');
  for (const r of rows) console.log('  ' + r.id.padEnd(14) + r.subject.padEnd(12) + r.source);
  return Object.fromEntries(rows.map((r) => [r.id, r.source]));
}

let hong = 0;
function ktra(dieuKien, mo) {
  console.log(`  ${dieuKien ? '✓' : '✗'} ${mo}`);
  if (!dieuKien) hong++;
}

/* ================= A ================= */
console.log('\n══════ TÌNH HUỐNG A — có mốc 010, bài cũ chưa từng phân loại chuyển sang "other" ══════');
{
  const root = moiThuMuc(TRUOC_010);
  const c = await moPGlite(root);
  process.chdir(root);
  await chayMigrations(c);                                   // 001..008
  await dungDuLieu(c.query);                                 // du lieu TRUOC 010
  themTep(root, ['010_nguon_bai_tap.sql']);
  await chayMigrations(c);                                   // 010 gan nguon
  // Dot nhap MOI: sau khi 010 chay
  await c.query(`INSERT INTO submissions (id,family_id,raw_text) VALUES ('sub_moi','fam1','Bài mới')`);
  for (const [id,,mon,lang] of BAI.filter((b) => b[1] === 'moi')) {
    await c.query(`INSERT INTO assignments (id,submission_id,child_id,subject,content,lang,source,due_date)
                   VALUES ($1,'sub_moi','minh',$2,'Nội dung bài',$3,$4,CURRENT_DATE)`,
      [id, mon, lang, lang === 'en' ? 'english_class' : 'primary_school']);
  }
  const truoc = await inBang(c.query, 'TRƯỚC khi chạy 011:');
  themTep(root, ['011_nguon_khac.sql']);
  const vuaChay = await chayMigrations(c, { log: (m) => console.log(`  chạy migration:${m}`) });
  const sau = await inBang(c.query, 'SAU khi chạy 011:');
  console.log('\n  Kết quả:');
  ktra(vuaChay.includes('011_nguon_khac.sql'), 'bộ chạy migration nhận đúng 011_nguon_khac.sql');
  for (const [id,,,, mo, kv] of BAI) ktra(sau[id] === kv, `${id} (${mo}) → ${sau[id]} [mong đợi ${kv}]`);
  ktra(truoc['asg_cu_toan'] === 'primary_school' && truoc['asg_cu_viet'] === 'primary_school',
    'trước 011 hai bài cũ đó đang là primary_school (đúng là 011 đổi chúng, không phải sẵn vậy)');
  process.chdir(REPO);
}

/* ================= B ================= */
console.log('\n══════ TÌNH HUỐNG B — mất mốc _migrations của 010 → KHÔNG đổi gì cả ══════');
{
  const root = moiThuMuc(TRUOC_010);
  const c = await moPGlite(root);
  process.chdir(root);
  await chayMigrations(c);
  await dungDuLieu(c.query);
  themTep(root, ['010_nguon_bai_tap.sql']);
  await chayMigrations(c);
  await c.query(`DELETE FROM _migrations WHERE name = '010_nguon_bai_tap.sql'`);  // moc bien mat
  const truoc = await inBang(c.query, 'TRƯỚC khi chạy 011 (đã xoá mốc 010):');
  // Chay rieng 011 (bo chay se doi chay lai ca 010 neu goi chayMigrations)
  const { readFileSync } = await import('node:fs');
  await c.query(readFileSync(join(MIGS, '011_nguon_khac.sql'), 'utf8'));
  const sau = await inBang(c.query, 'SAU khi chạy 011:');
  console.log('\n  Kết quả:');
  ktra(JSON.stringify(truoc) === JSON.stringify(sau), 'không một dòng nào đổi nguồn khi thiếu mốc 010');
  ktra(!Object.values(sau).includes('other'), 'không bài nào bị gom nhầm vào "other"');
  process.chdir(REPO);
}

/* ================= C ================= */
console.log('\n══════ TÌNH HUỐNG C — DB mới tinh, chạy hết 001..011 ══════');
{
  const root = moiThuMuc([]);
  cpSync(MIGS, join(root, 'migrations'), { recursive: true });
  const c = await moPGlite(root);
  process.chdir(root);
  const vuaChay = await chayMigrations(c, { log: (m) => console.log(` ${m}`) });
  console.log('\n  Kết quả:');
  ktra(vuaChay.length === 9 && vuaChay.at(-1) === '011_nguon_khac.sql', `chạy hết ${vuaChay.length} migration, không lỗi`);
  const [{ n }] = await c.query(`SELECT COUNT(*) AS n FROM assignments`);
  ktra(String(n) === '0', 'DB mới không có bài tập nào — 011 chạy sạch trên DB trống');
  process.chdir(REPO);
}

console.log(hong === 0 ? '\n✅ TẤT CẢ KIỂM CHỨNG ĐỀU ĐẠT\n' : `\n❌ ${hong} kiểm chứng KHÔNG đạt\n`);
process.exit(hong === 0 ? 0 : 1);
