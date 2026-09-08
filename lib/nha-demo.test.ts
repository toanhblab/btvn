/**
 * Ba nha demo (issue #46: PIN 1111 Nhat, 2222 Han, 3333 Anh) — chay THAT tren
 * PGlite trong RAM, qua CHINH lib/store.ts va scripts/seed-demo.mjs (khong mo
 * phong lai SQL — scripts/test-hook.mjs cho node resolve import khong duoi;
 * BTVN_PGLITE_DIR=memory:// de lib/db.ts khong dung vao ./.data/pg).
 *
 * Nhung dieu de vo ma khong ai thay, kiem o day:
 *   1. Nang DB dang co nha: cot ui_locale (migration 018) mac dinh 'vi' cho nha
 *      cu — nha that cua captain khong doi gi. CHECK chan gia tri la.
 *   2. Nap demo TREN DB DANG CO NHA THAT: chup toan bo du lieu cua nha that
 *      truoc/sau (moi bang) — phai GIONG HET; chay lai lan hai khong sinh ban
 *      trung (so dong moi bang cua ca DB khong doi).
 *   3. PIN demo dang la cua mot nha THAT (dang ky truoc khi giu cho): bo qua
 *      nha demo do, khong dong vao nha that; bo nha do di thi lan sau nap duoc.
 *   4. AN TOAN (rang buoc cua firstmate): nha demo co PIN de doan nhat, nguoi la
 *      mo trung se vao duoc — chap nhan VOI DIEU KIEN khong co duong nao tu nha
 *      demo nhin sang nha khac. Goi MOI ham doc cua store voi familyId demo:
 *      moi dong tra ve deu thuoc nha demo; ham lay theo id voi id cua nha that
 *      tra null; va chieu nguoc lai (nha that khong thay demo).
 *   5. Nhap PIN 1111/2222/3333 -> dung nha, dung ngon ngu; moi nha demo co du
 *      thu de xem: con, bai hom qua/hom nay/mai, nhiem vu ca hai nhom, thuong,
 *      lich su diem, mot yeu cau dang cho, mot lan bi tru — khong man nao trong.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.BTVN_PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
delete process.env.DATABASE_URL_UNPOOLED; delete process.env.POSTGRES_URL_NON_POOLING;

const { query, queryTx } = await import('./db.ts');
const store = await import('./store.ts');
const { chayMigrations } = await import('../scripts/db.mjs');
const { napNhaDemo, idNhaDemo, ngayLech } = await import('../scripts/seed-demo.mjs');
const { PIN_DEMO } = await import('./i18n/ngonNgu.ts');

/** Cung khuon voi moKetNoi (scripts/db.mjs) nhung di qua lib/db.ts de dung chung PGlite voi store. */
const db = {
  query: (t: string, p: unknown[] = []) => query<Record<string, unknown>>(t, p),
  chayGoi: async (cau: { sql: string; params?: unknown[] }[]) => { await queryTx(cau); },
};

// Hash PIN y nhu lib/auth.ts (khong import duoc auth.ts: no keo next/headers).
const SECRET = 'dev-secret-doi-truoc-khi-deploy';
async function hashPin(pin: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${SECRET}:${pin}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const THAT = 'fam_that';
const BANG_THEO_NHA: Record<string, string> = {
  families: `SELECT * FROM families WHERE id = $1 ORDER BY id`,
  children: `SELECT * FROM children WHERE family_id = $1 ORDER BY id`,
  submissions: `SELECT * FROM submissions WHERE family_id = $1 ORDER BY id`,
  assignments: `SELECT a.* FROM assignments a JOIN children c ON c.id = a.child_id WHERE c.family_id = $1 ORDER BY a.id`,
  daily_chores: `SELECT * FROM daily_chores WHERE family_id = $1 ORDER BY id`,
  rewards: `SELECT * FROM rewards WHERE family_id = $1 ORDER BY id`,
  score_events: `SELECT e.* FROM score_events e JOIN children c ON c.id = e.child_id WHERE c.family_id = $1 ORDER BY e.id`,
  reward_redemptions: `SELECT r.* FROM reward_redemptions r JOIN children c ON c.id = r.child_id WHERE c.family_id = $1 ORDER BY r.id`,
  score_penalties: `SELECT p.* FROM score_penalties p JOIN children c ON c.id = p.child_id WHERE c.family_id = $1 ORDER BY p.id`,
};
async function chupNha(familyId: string) {
  const anh: Record<string, unknown[]> = {};
  for (const [bang, sql] of Object.entries(BANG_THEO_NHA)) anh[bang] = await db.query(sql, [familyId]);
  return anh;
}
async function demMoiBang() {
  const dem: Record<string, number> = {};
  for (const bang of Object.keys(BANG_THEO_NHA)) {
    dem[bang] = Number((await db.query(`SELECT COUNT(*) AS n FROM ${bang}`))[0].n);
  }
  return dem;
}

before(async () => {
  // Nha that ton tai TRUOC migration 018 (chay 001..017 truoc, chen nha, roi 018)
  const { danhSachMigration } = await import('../scripts/db.mjs');
  const tatCa = danhSachMigration();
  assert.ok(tatCa.includes('018_ngon_ngu_giao_dien.sql'));
  // chayMigrations chay het danh sach; de mo phong "nha co tu truoc 018" thi ghi
  // dong nha SAU KHI 017 chay: dung mot ban chay chi toi 017 bang cach danh dau
  // 018 la da chay, chen nha, roi go dau va chay lai.
  await db.query(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await db.query(`INSERT INTO _migrations (name) VALUES ('018_ngon_ngu_giao_dien.sql')`);
  await chayMigrations(db);
  await db.query(
    `INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ($1, 'Nhà thật', 'that-slug', $2)`,
    [THAT, await hashPin('1234')]
  );
  await db.query(`DELETE FROM _migrations WHERE name = '018_ngon_ngu_giao_dien.sql'`);
  await chayMigrations(db);

  // Du lieu cua nha that: 2 con, bai, nhiem vu, thuong, diem, yeu cau, phat
  for (const [id, name, i] of [['that_minh', 'Minh', 1], ['that_an', 'An', 2]] as const) {
    await db.query(
      `INSERT INTO children (id, family_id, name, avatar_url, color, grade, sort_order)
       VALUES ($1, $2, $3, '/img/x.jpg', $4, 'Lớp 1', $5)`,
      [id, THAT, name, i === 1 ? 'primary' : 'secondary', i]);
  }
  await store.seedDefaultChores(THAT);
  await db.query(
    `INSERT INTO assignments (id, child_id, subject, icon, content, due_date, status)
     VALUES ('that_asg_1', 'that_minh', 'Toán', '🔢', 'Bài 3 trang 34', $1, 'todo'),
            ('that_asg_2', 'that_an', 'Vẽ', '🎨', 'Vẽ ngôi nhà', $1, 'done')`, [ngayLech(0)]);
  await db.query(`INSERT INTO rewards (id, family_id, name, icon, cost) VALUES ('that_rwd', $1, 'Ăn kem', '🍦', 30)`, [THAT]);
  await db.query(`INSERT INTO score_events (id, child_id, kind, points, event_date) VALUES ('that_sev', 'that_minh', 'day_complete', 10, $1)`, [ngayLech(-1)]);
  await db.query(`INSERT INTO reward_redemptions (id, child_id, reward_id, reward_name, reward_icon, cost) VALUES ('that_rdm', 'that_minh', 'that_rwd', 'Ăn kem', '🍦', 30)`);
  await db.query(`INSERT INTO score_penalties (id, child_id, points, reason) VALUES ('that_pen', 'that_an', 1, 'Cãi bố mẹ')`);
});

test('018: nha co tu truoc nhan ui_locale = vi; CHECK chan gia tri la', async () => {
  const nha = await store.getFamilyById(THAT);
  assert.equal(nha?.ngonNgu, 'vi');
  await assert.rejects(
    db.query(`UPDATE families SET ui_locale = 'fr' WHERE id = $1`, [THAT]),
    /ui_locale|check/i
  );
});

test('nap demo len DB dang co nha that: nha that giu nguyen tung byte, chay lai khong sinh ban trung', async () => {
  const truoc = await chupNha(THAT);
  const kq1 = await napNhaDemo(db);
  assert.deepEqual(kq1.map((k: { lang: string; trangThai: string }) => [k.lang, k.trangThai]),
    [['ja', 'ok'], ['ko', 'ok'], ['en', 'ok']]);
  assert.deepEqual(await chupNha(THAT), truoc, 'nha that bi dong vao sau lan nap 1');

  const demSauLan1 = await demMoiBang();
  const kq2 = await napNhaDemo(db);
  assert.equal(kq2.filter((k: { trangThai: string }) => k.trangThai === 'ok').length, 3);
  assert.deepEqual(await demMoiBang(), demSauLan1, 'lan nap 2 doi so dong cua mot bang');
  assert.deepEqual(await chupNha(THAT), truoc, 'nha that bi dong vao sau lan nap 2');

  const nhaDemo = await db.query(`SELECT id, ui_locale, slug FROM families WHERE id LIKE 'fam_demo_%' ORDER BY id`);
  assert.deepEqual(nhaDemo, [
    { id: 'fam_demo_en', ui_locale: 'en', slug: 'demo-en' },
    { id: 'fam_demo_ja', ui_locale: 'ja', slug: 'demo-ja' },
    { id: 'fam_demo_ko', ui_locale: 'ko', slug: 'demo-ko' },
  ]);
});

test('PIN demo dang la cua mot nha that: bo qua nha demo do, khong dong vao nha that', async () => {
  const CHIEM = 'fam_chiem';
  await db.query(`DELETE FROM families WHERE id = $1`, [idNhaDemo('ja')]);
  await db.query(`INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ($1, 'Nhà chiếm 1111', 'chiem', $2)`,
    [CHIEM, await hashPin('1111')]);
  const truoc = await chupNha(CHIEM);
  const kq = await napNhaDemo(db);
  assert.deepEqual(kq.find((k: { lang: string }) => k.lang === 'ja')?.trangThai, 'bo-qua-trung-pin');
  assert.deepEqual(await chupNha(CHIEM), truoc);
  assert.equal((await db.query(`SELECT 1 FROM families WHERE id = $1`, [idNhaDemo('ja')])).length, 0);
  // Bo nha chiem di -> lan sau nap duoc
  await db.query(`DELETE FROM families WHERE id = $1`, [CHIEM]);
  const kq2 = await napNhaDemo(db);
  assert.equal(kq2.find((k: { lang: string }) => k.lang === 'ja')?.trangThai, 'ok');
});

test('nhap PIN 1111/2222/3333 -> dung nha demo, dung ngon ngu', async () => {
  for (const [pin, lang] of Object.entries(PIN_DEMO)) {
    const nha = await store.findFamilyByPinHash(await hashPin(pin));
    assert.equal(nha?.id, idNhaDemo(lang), `PIN ${pin}`);
    assert.equal(nha?.ngonNgu, lang, `PIN ${pin}`);
  }
  assert.equal((await store.findFamilyByPinHash(await hashPin('1234')))?.id, THAT);
});

test('KHONG co duong nao tu nha demo nhin sang nha khac (moi ham doc cua store), va nguoc lai', async () => {
  const demo = idNhaDemo('ja');
  const conDemo = new Set((await store.listChildren(demo)).map((c) => c.id));
  assert.equal(conDemo.size, 3);
  for (const c of conDemo) assert.ok(c.startsWith(`${demo}_con_`), `con la trong nha demo: ${c}`);
  const conThat = new Set((await store.listChildren(THAT)).map((c) => c.id));
  assert.deepEqual([...conThat].sort(), ['that_an', 'that_minh']);

  const thuocDemo = (rows: { childId: string }[], ten: string) => {
    assert.ok(rows.length > 0, `${ten}: demo phai co du lieu de xem`);
    for (const r of rows) assert.ok(conDemo.has(r.childId), `${ten}: dong cua con ${r.childId} lot vao nha demo`);
  };
  const rong = { from: '2000-01-01', to: '2100-01-01', includeChores: true } as const;
  thuocDemo(await store.listAssignments(demo, rong), 'listAssignments');
  thuocDemo(await store.listRedemptions(demo), 'listRedemptions');
  thuocDemo(await store.listPenalties(demo), 'listPenalties');
  thuocDemo((await store.progressUpcoming(demo)).map((r) => ({ childId: r.child.id })), 'progressUpcoming');
  assert.deepEqual([...(await store.soDiemTheoCon(demo)).keys()].sort(), [...conDemo].sort());
  assert.equal(await store.countAssignments(demo), (await store.listAssignments(demo, rong)).length);
  assert.ok((await store.listChores(demo)).length === 5);
  assert.ok((await store.listRewards(demo)).length === 4);

  // Lay theo id cua nha THAT tu nha demo -> khong thay gi
  assert.equal(await store.getChild(demo, 'that_minh'), null);
  assert.equal(await store.getAssignment(demo, 'that_asg_1'), null);
  assert.equal(await store.getReward(demo, 'that_rwd'), null);
  assert.equal(await store.getRedemption(demo, 'that_rdm'), null);
  const choreThat = (await store.listChores(THAT))[0];
  assert.equal(await store.getChore(demo, choreThat.id), null);
  assert.equal(await store.daCongDiemNgay(demo, 'that_minh', ngayLech(-1)), false);
  assert.equal(await store.soDiem(demo, 'that_minh'), 0);
  assert.equal(await store.countPendingRedemptions(demo), 1);
  // Ghi tu nha demo vao dong cua nha that -> tu choi / khong tac dung
  assert.equal((await store.xinDoiThuong(demo, 'that_minh', 'that_rwd')).ok, false);
  assert.equal((await store.truDiem(demo, 'that_minh', 1, '')).ok, false);
  assert.equal((await store.duyetDoiThuong(demo, 'that_rdm', true)).ok, false);
  await store.deleteAssignment(demo, 'that_asg_1');
  assert.ok(await store.getAssignment(THAT, 'that_asg_1'), 'nha demo xoa duoc bai cua nha that');

  // Chieu nguoc lai: nha that khong thay demo
  const idThat = (await store.listAssignments(THAT, rong)).map((a) => a.childId);
  for (const c of idThat) assert.ok(conThat.has(c));
  assert.equal((await store.listRedemptions(THAT)).length, 1);
  assert.equal((await store.listPenalties(THAT)).length, 1);
  assert.equal(await store.getChild(THAT, [...conDemo][0]), null);
  assert.equal(await store.countPendingRedemptions(THAT), 1);
});

test('moi nha demo co du thu de xem, khong man nao trong', async () => {
  for (const lang of ['ja', 'ko', 'en'] as const) {
    const fam = idNhaDemo(lang);
    const con = await store.listChildren(fam);
    assert.equal(con.length, 3, lang);
    const homNay = ngayLech(0);
    for (const c of con) {
      const bai = await store.listAssignments(fam, { childId: c.id, from: homNay, includeChores: true });
      assert.ok(bai.some((a) => a.choreId !== null && a.dueDate === homNay), `${lang}/${c.name}: co nhiem vu hom nay`);
      assert.ok(bai.some((a) => a.choreId === null), `${lang}/${c.name}: co bai tap`);
    }
    const nhom = new Set((await store.listChores(fam)).map((ch) => ch.nhom));
    assert.deepEqual([...nhom].sort(), ['after_study', 'housework'], `${lang}: du hai nhom nhiem vu`);
    const tienDo = await store.progressUpcoming(fam);
    assert.ok(tienDo.some((r) => r.points > 0), `${lang}: co diem de bang xep hang co nghia`);
    assert.ok(tienDo.some((r) => r.points !== tienDo[0].points), `${lang}: diem khac nhau de co thu hang`);
    assert.equal((await store.listRewards(fam)).length, 4, lang);
    assert.equal((await store.listRedemptions(fam, { status: 'pending' })).length, 1, `${lang}: mot yeu cau cho duyet`);
    assert.equal((await store.listRedemptions(fam, { status: 'approved' })).length, 1, lang);
    assert.equal((await store.listPenalties(fam)).length, 1, `${lang}: mot lan bi tru`);
    // Bai hom qua da xong het -> co +10 cua hom qua cho hai be lon
    assert.equal(await store.daCongDiemNgay(fam, con[0].id, ngayLech(-1)), true, lang);
    // Ten con / ten bai la chu cua ngon ngu do — khong con chu Viet co dau
    const DAU = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
    for (const c of con) assert.ok(!DAU.test(c.name), `${lang}: ten con ${c.name}`);
    for (const a of await store.listAssignments(fam, { from: '2000-01-01', to: '2100-01-01', includeChores: true })) {
      // `subject` cua dong NHIEM VU la VIEC_NHA_SUBJECT — khoa phan loai, khong
      // man nao ve ra (man cua con ve nhanh isChores, danh sach cua bo me loc
      // chore ra). Chi dong BAI TAP moi hien ten mon.
      const hien = a.choreId === null ? `${a.subject} ${a.content} ${a.note ?? ''}` : `${a.content} ${a.note ?? ''}`;
      assert.ok(!DAU.test(hien), `${lang}: bai ${a.content}`);
    }
    for (const r of await store.listRewards(fam)) assert.ok(!DAU.test(r.name), `${lang}: thuong ${r.name}`);
  }
});
