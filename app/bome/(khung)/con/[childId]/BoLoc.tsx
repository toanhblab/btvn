import Link from 'next/link';
import Form from 'next/form';
import { HW_SOURCES, type HwSource } from '@/lib/types';
import type { T } from '@/lib/i18n/chu';

/**
 * Hai bo loc cua man chi tiet con (issue #74): NOI GIAO va MOT NGAY cu the.
 *
 * Ca hai di qua query string chu khong qua state client, vi the man nay van la
 * server component nhu truoc: link chia se duoc, bam Quay lai cua trinh duyet ra
 * dung bo loc cu, va khong phai keo them mot cay useState nao xuong may bo me.
 */

/** Ba bo loc cua man — de chung mot kieu vi moi link phai giu nguyen hai cai kia. */
export interface BoLocMan {
  phamVi?: string;
  nguon?: HwSource;
  ngay?: string;
}

/**
 * Doi MOT bo loc, GIU nguyen hai bo loc kia. Bam chip "Smartkid" ma mat ngay dang
 * xem thi bo me phai chon lai tu dau — ma ba bo loc nay sinh ra de dung CUNG nhau.
 */
export function duongDan(childId: string, q: BoLocMan): string {
  const sp = new URLSearchParams();
  if (q.phamVi) sp.set('pham_vi', q.phamVi);
  if (q.nguon) sp.set('nguon', q.nguon);
  if (q.ngay) sp.set('ngay', q.ngay);
  const s = sp.toString();
  return `/bome/con/${childId}${s ? `?${s}` : ''}`;
}

/** Ngay ISO +/- n ngay. Tinh theo UTC de khong lech mot ngay o moc doi gio. */
export function ngayDich(iso: string, lech: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + lech);
  return d.toISOString().slice(0, 10);
}

const LOP_CHIP = 'px-4 min-h-p-tap flex items-center rounded-full text-p-body-sm font-bold border shrink-0';
const LOP_CHIP_TAT = 'bg-surface-container-lowest text-on-surface-variant border-surface-container-high';
const LOP_CHIP_BAT = 'bg-primary text-on-primary border-primary';

/**
 * Hang chip loc theo NOI GIAO. Lap qua HW_SOURCES chu khong viet cung hai ten:
 * lib/types.ts noi ro them nguon moi (lop ve, lop nhac...) la chi them vao bang do.
 *
 * Cuon ngang chu khong xuong dong: bon chip khong vua 390px (va ban dich ja/ko
 * con dai hon), ma hai hang chip cao 48px thi day het bai tap xuong duoi man.
 * `overflow-x-auto` giu phan tran BEN TRONG hop nay nen trang khong tran ngang.
 */
export function ChipNoiGiao({
  childId, loc, T,
}: { childId: string; loc: BoLocMan; T: T }) {
  const chips: { key: string; nhan: string; href: string; bat: boolean }[] = [
    {
      key: 'tat-ca',
      nhan: T('Tất cả'),
      href: duongDan(childId, { ...loc, nguon: undefined }),
      bat: !loc.nguon,
    },
    ...Object.entries(HW_SOURCES).map(([ma, { label, icon }]) => ({
      key: ma,
      nhan: `${icon} ${T(label)}`,
      href: duongDan(childId, { ...loc, nguon: ma as HwSource }),
      bat: loc.nguon === ma,
    })),
  ];

  return (
    <nav aria-label={T('Lọc theo nơi giao')} className="flex gap-2 mb-3 overflow-x-auto pb-1">
      {chips.map((c) => (
        <Link
          key={c.key}
          href={c.href}
          aria-current={c.bat ? 'page' : undefined}
          className={`${LOP_CHIP} ${c.bat ? LOP_CHIP_BAT : LOP_CHIP_TAT}`}
        >
          {c.nhan}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Chon MOT ngay: o ngay goc cua trinh duyet (iOS mo banh xe ngay san, khong can
 * thu vien nao) trong mot form GET, kem hai nut lui/tien mot ngay la link thang.
 *
 * `next/form` chu khong `<form method="get">` tran: cung nop ra `?ngay=...` va
 * van chay khi chua hydrate, nhung khi da hydrate thi dieu huong phia client nen
 * khong nhay trang. Hai bo loc kia di theo bang input an — khong dat input rong
 * de URL khong dinh `?pham_vi=` trong tron.
 */
export function ChonNgay({
  childId, loc, moc, T,
}: { childId: string; loc: BoLocMan; moc: string; T: T }) {
  const lopNut =
    'min-h-p-tap w-11 shrink-0 flex items-center justify-center rounded-full border ' +
    'border-surface-container-high bg-surface-container-lowest text-on-surface-variant';

  return (
    <div className="flex items-center gap-1.5 mb-4">
      <Link
        href={duongDan(childId, { ...loc, ngay: ngayDich(moc, -1) })}
        aria-label={T('Hôm trước')}
        className={lopNut}
      >
        <span className="material-symbols-outlined">chevron_left</span>
      </Link>

      <Form action={`/bome/con/${childId}`} className="flex items-center gap-1.5 flex-1 min-w-0">
        {loc.phamVi && <input type="hidden" name="pham_vi" value={loc.phamVi} />}
        {loc.nguon && <input type="hidden" name="nguon" value={loc.nguon} />}
        <input
          type="date"
          name="ngay"
          defaultValue={moc}
          aria-label={T('Chọn ngày')}
          className="flex-1 min-w-0 rounded-lg border border-outline-variant min-h-p-tap px-2
                     text-p-body bg-surface-container-lowest text-on-surface"
        />
        <button
          type="submit"
          className="min-h-p-tap px-4 shrink-0 rounded-full bg-secondary-container
                     text-on-secondary-container text-p-body-sm font-bold"
        >
          {T('Xem')}
        </button>
      </Form>

      <Link
        href={duongDan(childId, { ...loc, ngay: ngayDich(moc, 1) })}
        aria-label={T('Hôm sau')}
        className={lopNut}
      >
        <span className="material-symbols-outlined">chevron_right</span>
      </Link>
    </div>
  );
}
