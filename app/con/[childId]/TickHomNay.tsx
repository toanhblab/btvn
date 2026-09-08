'use client';

import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { conLaiHomNay, type MocHomNay, type TickLacQuan } from '@/lib/tickHomNay';

/**
 * Nguon dem dung chung cho MOI nhom nhiem vu tren man bai cua mot con (issue
 * #42 co hai nhom). Moi nhom la mot <ViecNhaBai> rieng nhung tick lac quan cua
 * ca hai nhom nam trong map o day, nen `conLai()` cua nhom nay THAY duoc tick
 * cua nhom kia — khong thi con tick het ca hai nhom lien tuc se khong duoc day
 * sang man khen /xong. Luat dem la ham thuan lib/tickHomNay.ts (co test).
 *
 * State nam trong component nay, khong phai bien module: hai con dung hai the
 * khac nhau, va roi trang la reset — khong co kho trang thai toan cuc nao.
 */
type BoTickHomNay = {
  /** Tick lac quan cua CA HAI nhom; thieu key = chua dung den dong do. */
  daTick: TickLacQuan;
  /** Ghi tick lac quan cho mot dong (hoac hoan lai khi API loi). */
  datTick: (id: string, done: boolean) => void;
  /** So dong 'todo' cua hom nay con lai, tinh tu tick MOI NHAT cua ca hai nhom. */
  conLai: () => number;
};

const Ctx = createContext<BoTickHomNay | null>(null);

export function useTickHomNay(): BoTickHomNay {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('Thieu <TickHomNay> boc ngoai danh sach nhiem vu');
  return ctx;
}

export default function TickHomNay({
  todoHomNay,
  mocHomNay,
  children,
}: {
  /** So dong 'todo' cua hom nay theo may chu (bai that + nhiem vu). */
  todoHomNay: number;
  /** Trang thai may chu cua cac dong CUA HOM NAY, cung lan dung trang voi todoHomNay. */
  mocHomNay: MocHomNay;
  children: ReactNode;
}) {
  const [daTick, setDaTick] = useState<TickLacQuan>({});
  // Ban sao ref de nhom tick sau doc duoc ngay tick cua nhom truoc: hai cu tick
  // lien tuc co the xay ra trong CUNG mot nhip render, luc do state `daTick`
  // chua kip cap nhat.
  const moiNhat = useRef<TickLacQuan>(daTick);

  function datTick(id: string, done: boolean) {
    const sau = { ...moiNhat.current, [id]: done };
    moiNhat.current = sau;
    setDaTick(sau);
  }

  return (
    <Ctx.Provider
      value={{
        daTick,
        datTick,
        conLai: () => conLaiHomNay(todoHomNay, mocHomNay, moiNhat.current),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
