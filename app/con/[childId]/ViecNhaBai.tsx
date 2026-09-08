'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Assignment, DiemVuaCong } from '@/lib/types';

/**
 * Danh sach nhiem vu hang ngay trong hai nhom cuoi trang bai hom nay (issue
 * #36, #42). Tung dong o day la mot dong assignments THAT (chore_id khong null)
 * — tick qua CUNG API voi bai tap thuong (PATCH /api/assignments/:id), KHONG
 * con qua setChoreCheck/daily_chore_checks nua.
 *
 * The rieng, KHONG dung <Link> sang /bai/[id]: man do doc to de bai bang giong
 * noi, co dong ho dem nguoc, co the yeu cau quay video — khong hop cho mot viec
 * don gian nhu "tat den hoc". Bam la tick tai cho.
 *
 * Moi dong: icon rieng cua nhiem vu (a.icon, chep tu cau hinh luc tao), chu,
 * chip "⭐ N" ben phai neu dong co sao (a.stars — dong viec nha cu tao truoc
 * migration 016 thi khong co, khong hien chip). Tick xong ma may chu VUA cong sao
 * (diem.nhiemVu > 0) thi hien chip "+N ⭐" ngay tren dong do — bo tick khong
 * rut, tick lai khong cong lai (unique index o DB), nen chip chi hien dung mot
 * lan; +10 cua ca ngay do man /xong bao (khong bao hai lan).
 *
 * Bam la ghi ngay (lac quan) roi hoan lai neu API loi: tre bam xong ma the
 * doi mau sau nua giay thi be tuong may hong, bam lai lien tuc.
 *
 * @param laHomNay      nhom nay la nhom cua HOM NAY (chi hom nay moi dan sang
 *                      man khen — xong bai ngay mai thi chua "het viec hom nay").
 * @param todoHomNay    so dong con 'todo' cua HOM NAY theo du lieu may chu (ca
 *                      bai that lan nhiem vu), do trang cha dem san. Tick den khi
 *                      con lai 0 thi day sang /xong, dung co che `stillTodo <= 1`
 *                      cua app/con/[childId]/bai/[id]/page.tsx.
 */
export default function ViecNhaBai({
  items,
  childId,
  laHomNay,
  todoHomNay,
}: {
  items: Assignment[];
  childId: string;
  laHomNay: boolean;
  todoHomNay: number;
}) {
  const router = useRouter();
  const [xong, setXong] = useState<string[]>(() =>
    items.filter((a) => a.status === 'done').map((a) => a.id)
  );
  /** id dong -> so sao VUA duoc cong o lan tick nay (chip "+N ⭐"). */
  const [saoVuaCong, setSaoVuaCong] = useState<Record<string, number>>({});

  /**
   * Con bao nhieu dong 'todo' cua hom nay neu danh sach da tick tai cho la `daTick`.
   *
   * Lay so cua may chu roi cong tru phan nguoi dung vua doi ma may chu chua thay:
   * `items` va `todoHomNay` cung den tu MOT lan dung trang, nen du router.refresh()
   * chay xong giua chung (moc moi cho ca hai) hay chua kip (moc cu cho ca hai) thi
   * phep tru nay van ra dung so.
   */
  function conLai(daTick: string[]): number {
    let n = todoHomNay;
    for (const a of items) {
      if (a.status !== 'done' && daTick.includes(a.id)) n -= 1;
      if (a.status === 'done' && !daTick.includes(a.id)) n += 1;
    }
    return n;
  }

  async function tick(a: Assignment) {
    const done = !xong.includes(a.id);
    const daTick = done ? [...xong, a.id] : xong.filter((x) => x !== a.id);
    setXong(daTick);
    try {
      const res = await fetch(`/api/assignments/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: done ? 'done' : 'todo' }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json().catch(() => ({}))) as { diem?: DiemVuaCong };
      const sao = data.diem?.nhiemVu ?? 0;
      if (sao > 0) setSaoVuaCong((m) => ({ ...m, [a.id]: sao }));

      // Tick not viec cuoi cung cua hom nay -> man khen, giong het duong di khi
      // con lam xong bai that cuoi cung (ChiTietBai.tsx). Vua duoc sao thi cho
      // con nhin thay chip "+N ⭐" mot nhip roi moi chuyen man.
      if (done && laHomNay && conLai(daTick) <= 0) {
        setTimeout(() => router.push(`/con/${childId}/xong`), sao > 0 ? 900 : 0);
        return;
      }
      // Moi con so quanh danh sach nay (tien do "x/y bai hom nay da xong", tieu
      // de nhom "x/3 việc xong", vien ⭐ tong o goc tren) deu dung o may chu —
      // khong lam moi thi con tick het ma man hinh van bao chua xong.
      router.refresh();
    } catch {
      setXong((ds) => (done ? ds.filter((x) => x !== a.id) : [...ds, a.id]));
    }
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((a) => {
        const done = xong.includes(a.id);
        const vuaCong = saoVuaCong[a.id];
        return (
          <li key={a.id}>
            <button
              onClick={() => tick(a)}
              aria-pressed={done}
              className={`w-full min-h-k-tap flex items-center gap-4 px-5 py-2 rounded-kid text-left
                          border-4 transition-colors interactive-shadow
                          ${done
                            ? 'bg-success-container border-success'
                            : 'bg-surface-container-lowest border-transparent'}`}
            >
              <span
                className={`w-12 h-12 rounded-full shrink-0 border-4 flex items-center justify-center
                            ${done
                              ? 'bg-success border-success text-on-primary'
                              : 'bg-surface-container-lowest border-outline-variant'}`}
              >
                {done && <span className="material-symbols-outlined icon-fill">check</span>}
              </span>
              <span className="text-4xl shrink-0" aria-hidden>{a.icon}</span>
              <span
                className={`flex-1 min-w-0 text-k-body font-bold ${done ? 'text-on-success-container' : 'text-on-surface'}`}
              >
                {a.content}
              </span>
              {/* Chip "+N ⭐" vua cong, hoac chip gia "⭐ N" cua nhiem vu. Mau ho
                  phach (tertiary-fixed) dung chung cho moi cho hien ⭐ trong app. */}
              {vuaCong ? (
                <span
                  className="shrink-0 text-k-label bg-tertiary-fixed text-on-tertiary-fixed px-4 py-1.5
                             rounded-full soft-shadow animate-bounce whitespace-nowrap"
                >
                  +{vuaCong} ⭐
                </span>
              ) : a.stars ? (
                <span
                  className={`shrink-0 text-k-label px-4 py-1.5 rounded-full whitespace-nowrap ${
                    done
                      ? 'bg-success text-white'
                      : 'bg-tertiary-fixed text-on-tertiary-fixed'
                  }`}
                >
                  ⭐ {a.stars}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
