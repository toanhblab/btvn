/**
 * Hook resolve cho `node --test`: cho phep tep .ts cua app import KHONG DUOI
 * (`from './db'`, `from '@/lib/types'`) nhu Next bundler van lam.
 *
 * Truoc day test khong import duoc lib/store.ts, lib/types.ts... vi node doi
 * `./db.ts` co duoi, nen cac test PGlite phai MO PHONG LAI SQL cua store (xem
 * chu thich dau lib/tinh-diem.test.ts). Tu issue #46 (lib/types.ts import
 * lib/i18n/chu.ts khong duoi) thi ngay ca types.ts cung khong nap duoc, nen
 * them hook nay: `npm test` nap no qua `--import`. Thu lan luot `.ts`, `.tsx`,
 * `/index.ts`; alias `@/` tro ve goc du an (tsconfig paths). Voi goi thu vien thi
 * thu them duoi `.js` khi node bo tay (`next/headers`, `next/server` — goi next
 * khong co truong "exports").
 *
 * Node 24 dang chay strip-types san (khong can flag) — hook chi lo phan resolve.
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const GOC = process.cwd();
const DUOI = ['.ts', '.tsx', '/index.ts'];

registerHooks({
  resolve(specifier, context, nextResolve) {
    const alias = specifier.startsWith('@/');
    const tuongDoi = specifier.startsWith('./') || specifier.startsWith('../');
    const coDuoi = /\.(m?[jt]sx?|json|mjs|cjs)$/.test(specifier);

    // Goi thu vien ('next/headers', 'next/server'): goi next KHONG co truong
    // "exports" nen node doi duoi .js, con bundler cua Next thi khong — them duoi
    // khi node bo tay, de test nap duoc route handler / lib/auth.ts.
    if (!alias && !tuongDoi) {
      try {
        return nextResolve(specifier, context);
      } catch (loi) {
        if (coDuoi) throw loi;
        try { return nextResolve(`${specifier}.js`, context); } catch { throw loi; }
      }
    }
    if (coDuoi) return nextResolve(specifier, context);

    const goc = alias ? pathToFileURL(join(GOC, specifier.slice(2))).href : specifier;
    for (const duoi of DUOI) {
      try {
        const r = nextResolve(goc + duoi, context);
        if (!r.url.startsWith('file:') || existsSync(new URL(r.url))) return r;
      } catch { /* thu duoi tiep */ }
    }
    return nextResolve(specifier, context);
  },
});
