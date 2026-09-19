/**
 * Issue #75 — "bai da xong cua hom qua van hien tren iPad cua con".
 *
 * Luat loc (lib/nhomNhiemVu.ts) DUNG tu #62; cai sai la MOC "hom nay" dua vao
 * luat: `todayISO()` (lib/store.ts) tung lay ngay theo dong ho CUA MAY CHU
 * (`new Date()` + `getDate()`). Man cua con la server component chay o ham
 * Vercel (TZ=UTC), nha o +07 — tu 00:00 den 07:00 sang gio nha, "hom nay" cua
 * may chu van la HOM QUA: bai da xong hom qua hien duoi nhan "Hôm nay", bai cua
 * hom nay that bi coi la "ngay mai" nen `to: today` cat mat, va nhiem vu hang
 * ngay duoc tao cho ngay sai. May dev chay +07 nen khong test nao truoc do lo.
 *
 * Vi the moi bai o day chay MAN CUA CON (dung nhung ham ma
 * app/con/[childId]/page.tsx goi, tren PGlite trong RAM) trong mot tien trinh
 * node con co TZ KHAC va dong ho GIA (`mock.timers`, apis Date — PGlite cung doc
 * dong ho do nen `now()` cua DB lech theo, y nhu Neon tren Vercel) — cung cach
 * lib/ngay.test.ts kiem `ngayNha`. Vi du la dung vi du cua captain trong issue:
 * hom nay 19/09/2026, bai da xong cua 17/09 va 18/09 phai an.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const HOOK = new URL('../scripts/test-hook.mjs', import.meta.url).pathname;
const url = (p: string) => JSON.stringify(new URL(p, import.meta.url).href);

/** 06:30 sang 19/09 gio nha — may chu UTC con dang o 18/09. */
const SANG_SOM = '2026-09-18T23:30:00Z';
/** 08:00 sang 19/09 gio nha — hai mui gio da cung ngay, phep thu phan chung. */
const SANG_MUON = '2026-09-19T01:00:00Z';

interface KetQua { today: string; homQua: string; ve: string[] }

/**
 * Dung lai man cua con voi bon bai cua mot con: xong 17/09, xong 18/09, no
 * 18/09, va bai 19/09 chua lam — roi tra ve nhung dong man do VE RA.
 */
function manConVoi(tz: string, moc: string): KetQua {
  const kichBan = `
    import { mock } from 'node:test';
    mock.timers.enable({ apis: ['Date'], now: Date.parse(${JSON.stringify(moc)}) });
    process.env.BTVN_PGLITE_DIR = 'memory://';
    delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
    delete process.env.DATABASE_URL_UNPOOLED; delete process.env.POSTGRES_URL_NON_POOLING;
    const { query, queryTx } = await import(${url('./db.ts')});
    const store = await import(${url('./store.ts')});
    const { dongTrenManCuaCon } = await import(${url('./nhomNhiemVu.ts')});
    const { chayMigrations } = await import(${url('../scripts/db.mjs')});
    await chayMigrations({
      query: (t, p = []) => query(t, p),
      chayGoi: async (cau) => { await queryTx(cau); },
    });
    await query("INSERT INTO families (id, name, slug, parent_pin_hash) VALUES ('fam', 'Nha', 'nha', 'x')");
    await query("INSERT INTO children (id, family_id, name, avatar_url, color) VALUES ('con', 'fam', 'Bo', '', 'primary')");
    for (const [id, ngay, st] of [
      ['xong-17-09', '2026-09-17', 'done'],
      ['xong-18-09', '2026-09-18', 'done'],
      ['no-18-09', '2026-09-18', 'todo'],
      ['bai-19-09', '2026-09-19', 'todo'],
    ]) {
      await query(
        "INSERT INTO assignments (id, child_id, subject, icon, content, due_date, source, status) " +
        "VALUES ($1, 'con', 'Toan', '📝', $1, $2, 'primary_school', $3)",
        [id, ngay, st]
      );
    }
    // Dung trinh tu cua app/con/[childId]/page.tsx
    const today = store.todayISO();
    await store.taoNhiemVuNgay('fam', today, ['con']);
    const tuDB = await store.listAssignments('fam', {
      childId: 'con', from: today, to: today, includeChores: true, keCaBaiChuaXongTruocDo: true,
    });
    const ve = dongTrenManCuaCon(tuDB, today).map((a) => a.id);
    process.stdout.write(JSON.stringify({ today, homQua: store.todayISO(-1), ve }));
    process.exit(0);
  `;
  const out = execFileSync(
    process.execPath,
    ['--import', HOOK, '--input-type=module', '--eval', kichBan],
    { env: { ...process.env, TZ: tz }, encoding: 'utf8' }
  );
  return JSON.parse(out) as KetQua;
}

const MONG_DOI: KetQua = {
  today: '2026-09-19',
  homQua: '2026-09-18',
  ve: ['no-18-09', 'bai-19-09'],
};

test('#75: 06:30 sang 19/09 gio nha, may chu UTC — bai da xong 17/09 va 18/09 AN, bai no 18/09 va bai 19/09 HIEN', () => {
  assert.deepEqual(manConVoi('UTC', SANG_SOM), MONG_DOI);
});

test('#75: cung du lieu, 08:00 sang 19/09 (hai mui gio cung ngay) — van dung (phan chung)', () => {
  assert.deepEqual(manConVoi('UTC', SANG_MUON), MONG_DOI);
});

test('#75: may chu o mui gio nao cung ra cung mot man (khong dua vao bien TZ cua Vercel)', () => {
  for (const tz of ['Asia/Ho_Chi_Minh', 'America/New_York', 'Pacific/Kiritimati']) {
    assert.deepEqual(manConVoi(tz, SANG_SOM), MONG_DOI, `TZ=${tz}`);
  }
});
