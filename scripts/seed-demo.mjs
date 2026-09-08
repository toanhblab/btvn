/**
 * Nap / nap LAI ba nha demo (issue #46): PIN 1111 tieng Nhat, 2222 tieng Han,
 * 3333 tieng Anh. Captain demo cho khach hang bang cach nhap PIN.
 *
 *   npm run db:seed:demo                    -> DB local (PGlite)
 *   DATABASE_URL=... npm run db:seed:demo   -> DB that (an toan, xem duoi)
 *
 * Chay tren DB DANG CHAY duoc, chay lai bao nhieu lan cung duoc:
 *   - id cua ba nha la CO DINH (fam_demo_ja/ko/en), dong families UPSERT theo id
 *     nen khong bao gio co hai nha demo cung ngon ngu.
 *   - Du lieu ben trong (con, bai, nhiem vu, thuong, diem) duoc XOA het roi nap
 *     lai trong MOT transaction — moi lan chay la mot ban demo sach, ngay thang
 *     tinh lai theo hom nay. Moi cau xoa deu loc theo family_id cua nha demo:
 *     KHONG DUNG toi bat ky nha nao khac. Bai kiem lib/nha-demo.test.ts chup
 *     toan bo du lieu cua mot nha that truoc/sau khi nap de khang dinh dieu do.
 *   - PIN demo ma mot nha THAT dang dung (dang ky truoc khi co giu cho): bo qua
 *     nha demo do va bao ra, khong dong vao nha that.
 *
 * Duoc goi trong `npm run build` (sau migrate) de moi lan deploy ban demo lai
 * moi; loi o day KHONG lam hong build (bat o catch, thoat 0).
 *
 * Chu trong du lieu la chu BO ME GO nen viet thang theo ngon ngu (scripts/demo-data.mjs).
 */
import { pathToFileURL } from 'node:url';
import { chayMigrations, moKetNoi, CONN } from './db.mjs';

const SECRET_MAC_DINH = 'dev-secret-doi-truoc-khi-deploy';

/**
 * Ba phu thuoc duoi day la tep .ts, nap bang import() DONG chu khong phai import
 * tinh: import tinh duoc phan giai TRUOC khi vao try/catch o cuoi tep, nen tren
 * mot ban Node khong tu bo kieu san (Node 20, hay 22 duoi 22.18) ca `npm run
 * build` chet vi ERR_UNKNOWN_FILE_EXTENSION — dung thu ma loi cua demo lam hong
 * ban deploy that. Nap dong thi loi roi vao dung catch da co.
 */
let phuThuocDaNap;
async function phuThuoc() {
  if (!phuThuocDaNap) {
    const [sqlNhiemVu, ngonNgu, demoData] = await Promise.all([
      import('../lib/sqlNhiemVu.ts'),
      import('../lib/i18n/ngonNgu.ts'),
      import('./demo-data.mjs'),
    ]);
    phuThuocDaNap = {
      SQL_TAO_NHIEM_VU_NGAY: sqlNhiemVu.SQL_TAO_NHIEM_VU_NGAY,
      PIN_DEMO: ngonNgu.PIN_DEMO,
      NHA_DEMO: demoData.NHA_DEMO,
    };
  }
  return phuThuocDaNap;
}

/** Id CO DINH cua mot nha demo — nap lai bao nhieu lan cung dung mot dong families. */
export const idNhaDemo = (lang) => `fam_demo_${lang}`;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Ngay theo lich may chay, YYYY-MM-DD, lech `days` ngay — cung khuon todayISO cua app. */
export function ngayLech(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Goi cau lenh nap MOT nha demo. Chi dung tren du lieu, khong goi DB (async chi
 * vi doc du lieu mau qua `phuThuoc()`) — nguoi goi chay ca goi trong mot
 * transaction (db.chayGoi).
 */
export async function goiLenhNhaDemo(lang, pinHash) {
  const { NHA_DEMO, SQL_TAO_NHIEM_VU_NGAY } = await phuThuoc();
  const d = NHA_DEMO[lang];
  const fam = idNhaDemo(lang);
  const id = (s) => `${fam}_${s}`;
  const cid = (c) => id(`con_${c}`);
  const homQua = ngayLech(-1), homNay = ngayLech(0), mai = ngayLech(1);
  const cau = [];
  const q = (sql, params) => cau.push({ sql, params });

  // 1. Nha: upsert theo id co dinh. score_since lui 30 ngay de lich su diem duoc tinh.
  q(`INSERT INTO families (id, name, slug, parent_pin_hash, ui_locale, score_since)
     VALUES ($1, $2, $3, $4, $5, CURRENT_DATE - 30)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, parent_pin_hash = EXCLUDED.parent_pin_hash,
           ui_locale = EXCLUDED.ui_locale, score_since = EXCLUDED.score_since`,
    [fam, d.ten, `demo-${lang}`, pinHash, lang]);

  // 2. Xoa sach ben trong nha demo — CHI theo family_id cua nha demo (CASCADE keo
  //    theo assignments, score_events, reward_redemptions, score_penalties).
  for (const bang of ['children', 'daily_chores', 'rewards', 'submissions']) {
    q(`DELETE FROM ${bang} WHERE family_id = $1`, [fam]);
  }

  // 3. Con
  d.con.forEach((c, i) => q(
    `INSERT INTO children (id, family_id, name, avatar_url, color, grade, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [cid(c.id), fam, c.ten, c.anh, c.mau, c.lop, i + 1]));

  // 4. Nhiem vu hang ngay: 3 "sau khi hoc" (mac dinh 1 ⭐ / 🧹 / ca nha) + 2 viec nha
  d.nhiemVuSauHoc.forEach((ten, i) => q(
    `INSERT INTO daily_chores (id, family_id, content, sort_order) VALUES ($1,$2,$3,$4)`,
    [id(`chr_${i + 1}`), fam, ten, i + 1]));
  d.vietNha.forEach((v, i) => q(
    `INSERT INTO daily_chores (id, family_id, content, icon, stars, category, child_ids, sort_order)
     VALUES ($1,$2,$3,$4,$5,'housework',$6,$7)`,
    [id(`chr_nha_${i + 1}`), fam, v.ten, v.icon, v.sao, v.con ? v.con.map(cid) : null,
     d.nhiemVuSauHoc.length + i + 1]));

  // 5. Bai tap. Mot submission chung (nhu bo me nhap mot lan cho ca hai be lop 1).
  const sub = id('sub');
  q(`INSERT INTO submissions (id, family_id, raw_text, source) VALUES ($1,$2,$3,'primary_school')`,
    [sub, fam, d.baiHomNay.map((b) => b[2]).join('\n')]);
  const [conA, conB, conNho] = d.con.map((c) => cid(c.id));
  const bai = (asgId, childId, b, dueDate, extra = {}) => q(
    `INSERT INTO assignments (id, submission_id, child_id, subject, icon, content, note, lang, source,
        due_date, requires_video, status, completed_at, started_at, submitted_video_url, submitted_video_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [asgId, sub, childId, b[0], b[1], b[2], b[3], b[4], b[5], dueDate, b[6],
     extra.done ? 'done' : 'todo',
     extra.done ? `${dueDate}T12:${extra.done}:00+07:00` : null,
     extra.startedAt ? `${dueDate}T11:${extra.startedAt}:00+07:00` : null,
     extra.video ? 'https://example.com/demo/video.mp4' : null,
     extra.video ? `${dueDate}T12:${extra.done}:00+07:00` : null]);

  const daXongHomQua = [];
  for (const [ci, childId] of [conA, conB].entries()) {
    // Hom qua: xong het, mot bai xong som (started_at truoc completed_at 8 phut)
    d.baiHomQua.forEach((b, i) => {
      const asgId = id(`asg_${ci}_qua_${i}`);
      daXongHomQua.push({ asgId, childId, somNeu: i === 0 });
      bai(asgId, childId, b, homQua, { done: 20 + i, startedAt: i === 0 ? 12 : undefined, video: b[6] });
    });
    // Hom nay: bai dau da xong, con lai cho tick
    d.baiHomNay.forEach((b, i) => bai(id(`asg_${ci}_nay_${i}`), childId, b, homNay, i === 0 ? { done: 5 } : {}));
    // Mai: mot bai
    d.baiMai.forEach((b, i) => bai(id(`asg_${ci}_mai_${i}`), childId, b, mai));
  }
  // Be nho: mot bai lop tieng Anh cho mai
  bai(id('asg_2_mai_0'), conNho, d.baiConNho, mai);

  // 6. Dong nhiem vu hang ngay — CHINH cau SQL cua app (lib/sqlNhiemVu.ts):
  //    hom nay ca nha (nhu mo man chon con), mai cho nhung con co bai (nhu saveSubmission),
  //    hom qua cho hai be lon roi danh dau xong het (lich su). 10 = DURATION_DEFAULT.
  const taoNhiemVu = (ngay, childIds) => q(SQL_TAO_NHIEM_VU_NGAY, [fam, ngay, d.vietNhaSubject, 'primary_school', 10, childIds]);
  taoNhiemVu(homNay, null);
  taoNhiemVu(mai, [conA, conB, conNho]);
  taoNhiemVu(homQua, [conA, conB]);
  q(`UPDATE assignments SET status = 'done', completed_at = ($2::date + time '19:30') AT TIME ZONE 'Asia/Ho_Chi_Minh'
      WHERE chore_id IS NOT NULL AND due_date = $2
        AND child_id IN (SELECT id FROM children WHERE family_id = $1)`, [fam, homQua]);
  // Hom nay: be nho da tick mot viec (de man con thay ca dong xong lan dong chua)
  q(`UPDATE assignments SET status = 'done', completed_at = now()
      WHERE id = (SELECT a.id FROM assignments a WHERE a.child_id = $1 AND a.due_date = $2
                    AND a.chore_id IS NOT NULL ORDER BY a.id LIMIT 1)`, [conNho, homNay]);

  // 7. Lich su diem (cung luat voi lib/store.ts: +sao moi nhiem vu, +1 xong som, +10 ngay xong)
  q(`INSERT INTO score_events (id, child_id, kind, points, event_date, assignment_id)
     SELECT 'sev_' || substr(md5(a.id), 1, 16), a.child_id, 'task_done', a.stars, a.due_date, a.id
       FROM assignments a JOIN children c ON c.id = a.child_id
      WHERE c.family_id = $1 AND a.chore_id IS NOT NULL AND a.status = 'done' AND a.stars IS NOT NULL
     ON CONFLICT DO NOTHING`, [fam]);
  for (const x of daXongHomQua) {
    if (x.somNeu) q(
      `INSERT INTO score_events (id, child_id, kind, points, event_date, assignment_id)
       VALUES ($1, $2, 'early_finish', 1, $3, $4)`, [id(`sev_som_${x.asgId}`), x.childId, homQua, x.asgId]);
  }
  // +10 cho hom qua (hai be lon) va vai ngay truoc — con A nhieu hon con B mot ngay
  // de bang xep hang co thu tu; be nho co hai ngay.
  const ngayXong = { [conA]: [-1, -2, -3, -4, -6], [conB]: [-1, -2, -4, -6], [conNho]: [-2, -3] };
  for (const [childId, lech] of Object.entries(ngayXong)) {
    for (const l of lech) q(
      `INSERT INTO score_events (id, child_id, kind, points, event_date)
       VALUES ($1, $2, 'day_complete', 10, $3)`, [id(`sev_ngay_${childId}_${-l}`), childId, ngayLech(l)]);
  }

  // 8. Phan thuong + mot lan da duyet (con A, hom qua) + mot yeu cau dang cho (con B)
  d.phanThuong.forEach(([icon, ten, gia], i) => q(
    `INSERT INTO rewards (id, family_id, name, icon, cost) VALUES ($1,$2,$3,$4,$5)`,
    [id(`rwd_${i}`), fam, ten, icon, gia]));
  q(`INSERT INTO reward_redemptions (id, child_id, reward_id, reward_name, reward_icon, cost, status, requested_at, decided_at)
     VALUES ($1,$2,$3,$4,$5,$6,'approved', now() - interval '1 day', now() - interval '23 hours')`,
    [id('rdm_duyet'), conA, id('rwd_0'), d.phanThuong[0][1], d.phanThuong[0][0], d.phanThuong[0][2]]);
  q(`INSERT INTO reward_redemptions (id, child_id, reward_id, reward_name, reward_icon, cost, status)
     VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
    [id('rdm_cho'), conB, id('rwd_1'), d.phanThuong[1][1], d.phanThuong[1][0], d.phanThuong[1][2]]);

  // 9. Mot lan bo me tru ⭐ (con nho, 2 ⭐, co ly do — con doc o cua hang)
  q(`INSERT INTO score_penalties (id, child_id, points, reason, created_at)
     VALUES ($1, $2, 2, $3, now() - interval '2 days')`, [id('pen_1'), conNho, d.lyDoTru]);

  return cau;
}

/**
 * Nap ca ba nha demo vao `db` ({ query, chayGoi } — cung giao dien voi moKetNoi
 * va voi bo doc cua test). Tra ve danh sach { lang, pin, trangThai }.
 */
export async function napNhaDemo(db, { secret = process.env.PIN_SECRET || SECRET_MAC_DINH, log = () => {} } = {}) {
  const { PIN_DEMO } = await phuThuoc();
  const ketQua = [];
  for (const [pin, lang] of Object.entries(PIN_DEMO)) {
    const hash = await sha256(`${secret}:${pin}`);
    const fam = idNhaDemo(lang);
    // PIN demo dang la cua mot nha THAT (dang ky truoc khi giu cho): khong dong vao.
    const trung = await db.query(
      `SELECT id, name FROM families WHERE parent_pin_hash = $1 AND id <> $2`, [hash, fam]);
    if (trung.length > 0) {
      log(`  ! PIN ${pin} dang la cua nha that "${trung[0].name}" — BO QUA nha demo ${lang}`);
      ketQua.push({ lang, pin, trangThai: 'bo-qua-trung-pin' });
      continue;
    }
    await db.chayGoi(await goiLenhNhaDemo(lang, hash));
    log(`  + nha demo ${lang} — PIN ${pin} — /nha/demo-${lang}`);
    ketQua.push({ lang, pin, trangThai: 'ok' });
  }
  return ketQua;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const db = await moKetNoi();
    console.log(`DB: ${db.ten}`);
    await chayMigrations(db);
    const kq = await napNhaDemo(db, { log: (m) => console.log(m) });
    console.log(`✓ Nha demo: ${kq.filter((k) => k.trangThai === 'ok').length}/${kq.length}` +
      (CONN ? '' : ' (PGlite local)'));
    process.exit(0);
  } catch (err) {
    // Nam trong `npm run build`: demo hong khong duoc lam hong ban deploy that
    console.error(`! Khong nap duoc nha demo: ${err instanceof Error ? err.message : err}`);
    process.exit(0);
  }
}
