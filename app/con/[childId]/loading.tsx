/**
 * Khung cho trong luc danh sach bai dang tai — de sua loi "an Quay lai rat cham".
 *
 * Trang /con/[childId] la force-dynamic, ma route dong KHONG CO loading.tsx thi
 * Next bo qua prefetch hoan toan: bam "Quay lai" xong man hinh dung yen cho het
 * mot vong goi may chu (do duoc ~0,3-0,6s tren may ban, tren iPad mang nha thi
 * hon) roi moi doi. Tre tuong may treo nen bam them may lan nua.
 *
 * Co tep nay thi Next prefetch san khung nay va doi man NGAY khi bam, du lieu
 * that chay ve sau. Khong lam may chu nhanh len — lam cho nut phan hoi tuc thi.
 */
export default function DangTai() {
  return (
    <main className="kid-scope min-h-screen flex flex-col p-k-edge">
      <header className="flex items-center gap-6 mb-k-stack">
        <div className="w-16 h-16 bg-surface-container rounded-2xl shrink-0" />
        <div className="w-16 h-16 bg-surface-container rounded-full shrink-0" />
        <div className="h-10 w-72 bg-surface-container rounded-full" />
      </header>

      {/* Ba the mo phong ba khoi bai tap; khong dem nguoc, khong chu, chi de mat
          biet "dang ra roi" — tre chua doc duoc chu nao (PRD muc 3). */}
      <div className="flex flex-col gap-k-stack" aria-hidden>
        <div className="h-28 bg-surface-container-low rounded-2xl" />
        <div className="h-28 bg-surface-container-low rounded-2xl" />
        <div className="h-28 bg-surface-container-low rounded-2xl" />
      </div>
    </main>
  );
}
