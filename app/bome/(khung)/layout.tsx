import ThanhDuoi from './ThanhDuoi';

/** Khung chung phan bo me: mobile-first, chua thanh dieu huong duoi. */
export default function BomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen max-w-lg mx-auto pb-24">
      {children}
      <ThanhDuoi />
    </div>
  );
}
