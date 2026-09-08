/**
 * Danh sach muc dieu huong cua bo me + luat "muc nao dang chon", dung CHUNG cho
 * hai thanh: `ThanhDuoi` (duoi 1280px) va `ThanhBen` (tu 1280px). Hai thanh
 * khong bao gio cung hien, nen neu moi ben giu mot ban sao thi lech nhau cung
 * khong ai thay luc review — de o day de chi co MOT cho phai sua.
 *
 * Bon tep thiet ke Macbook ve thanh ben KHAC NHAU (ten muc doi giua
 * "Nhiem vu"/"Bai tap" va "Them bai"/"Them moi", mau muc dang chon luc xanh luc
 * cam). Lay APP lam chuan: y cac muc + icon cua ThanhDuoi, mau dang chon la
 * primary. Muc "Thuong" (/bome/thuong) them sau, khong co trong ban thiet ke nao.
 */
export const TABS = [
  { href: '/bome', icon: 'home', label: 'Trang chủ' },
  { href: '/bome/them', icon: 'photo_camera', label: 'Thêm bài' },
  { href: '/bome/nhiem-vu', icon: 'checklist', label: 'Nhiệm vụ' },
  { href: '/bome/thuong', icon: 'redeem', label: 'Thưởng' },
  { href: '/bome/cai-dat', icon: 'settings', label: 'Cài đặt' },
];

/**
 * So khop theo DOAN duong dan, khong theo tien to chu: `/bome/nhiem-vu-hang-ngay`
 * (trang cai nhiem vu, vao tu Cai dat) khong duoc lam sang tab "Nhiem vu"
 * (`/bome/nhiem-vu`). Rieng `/bome` la trang chu nen phai khop tuyet doi, khong
 * thi muc nao cung sang.
 */
export function tabDangChon(path: string, href: string): boolean {
  if (href === '/bome') return path === '/bome';
  return path === href || path.startsWith(href + '/');
}
