import type { ChildColor } from './types';

/**
 * Anh tam cho con moi them: chu cai dau tren vong tron mau rieng cua con.
 *
 * Cot avatar_url la NOT NULL vi anh la thu tre dung de tu nhan ra minh (PRD muc
 * 3), nhung bat bo me phai chup anh ngay moi tao duoc ho so thi nhieu nguoi se
 * bo do giua duong. Cho anh tam nay vao truoc, bo me thay anh that sau — man
 * "Sua ho so" co san nut Doi anh.
 *
 * Dung SVG nhung trong data URL nen khong can them tep vao public/, va khong bao
 * gio lay anh cua con nha khac lam mac dinh.
 */

const NEN: Record<ChildColor, string> = {
  primary: '#d8e2ff',
  secondary: '#ffdbc8',
  tertiary: '#ffe083',
};

const CHU: Record<ChildColor, string> = {
  primary: '#0058be',
  secondary: '#5c2400',
  tertiary: '#574500',
};

export function anhTam(name: string, color: ChildColor): string {
  const chu = (name.trim()[0] ?? '?').toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">` +
    `<rect width="240" height="240" fill="${NEN[color]}"/>` +
    `<text x="120" y="120" fill="${CHU[color]}" font-family="Quicksand,sans-serif" ` +
    `font-size="130" font-weight="700" text-anchor="middle" dominant-baseline="central">${chu}</text>` +
    `</svg>`;
  // encodeURIComponent thay vi base64: giu duoc chu co dau tieng Viet
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
