import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite nap Postgres duoi dang WASM va doc file bang fs. Neu de bundler goi
  // vao thi trong server component se hong ("path argument ... Received an
  // instance of URL"). Danh dau external de Node nap thang tu node_modules.
  serverExternalPackages: ['@electric-sql/pglite'],

  // Khi dev, Next chi cho localhost tai cac tep JS cua trinh duyet. Mo bang IP
  // trong nha (dien thoai bo me, iPad cua con) thi nhung tep do bi tra 403,
  // React khong hydrate duoc va MOI NUT deu bam khong an — trang van hien binh
  // thuong nen rat de tuong la loi giao dien.
  //
  // Chi anh huong `next dev`. Ban deploy that khong dung toi.
  allowedDevOrigins: [
    '192.168.1.*',
    '192.168.100.*',
    '10.0.0.*',
    'Huys-MacBook-Pro.local',
  ],
};

export default nextConfig;
