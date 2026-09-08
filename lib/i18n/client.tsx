'use client';

import { createContext, useContext, useMemo } from 'react';
import { taoT, type T } from './chu';
import { NGON_NGU_MAC_DINH, type NgonNgu } from './ngonNgu';

/**
 * Ngon ngu cua nha dang mo, cho component client. `app/layout.tsx` (server) doc
 * tu DB roi boc ca app trong Provider nay; component client goi `useT()`.
 *
 * Khong co Provider (test, storybook) thi la tieng Viet — chu trong ma nguon.
 */
const NgonNguContext = createContext<NgonNgu>(NGON_NGU_MAC_DINH);

export function NgonNguProvider({ ngonNgu, children }: { ngonNgu: NgonNgu; children: React.ReactNode }) {
  return <NgonNguContext.Provider value={ngonNgu}>{children}</NgonNguContext.Provider>;
}

export function useNgonNgu(): NgonNgu {
  return useContext(NgonNguContext);
}

export function useT(): T {
  const ngonNgu = useNgonNgu();
  return useMemo(() => taoT(ngonNgu), [ngonNgu]);
}
