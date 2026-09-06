import { notFound, redirect } from 'next/navigation';
import { viewingFamilyId } from '@/lib/auth';
import { getAssignment, getChild, listAssignments, todayISO } from '@/lib/store';
import ChiTietBai from './ChiTietBai';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ childId: string; id: string }>;
}) {
  const { childId, id } = await params;
  const familyId = await viewingFamilyId();
  if (!familyId) redirect('/vao');

  const [child, assignment] = await Promise.all([
    getChild(familyId, childId),
    getAssignment(familyId, id),
  ]);

  if (!child || !assignment || assignment.childId !== childId) notFound();

  // Man chuc mung chi danh cho bai CUOI CUNG CUA HOM NAY: danh sach gio co ca bai
  // ngay mai, khen "lam het bai hom nay" khi con moi lam bai ngay mai thi sai.
  // includeChores: true — viec nha (issue #36) gio la dong assignments THAT,
  // phai tinh vao stillTodo: thieu co nay thi con lam xong bai THAT cuoi cung
  // se bi day sang man khen (/xong) TRUOC khi tick het viec nha, dung y cu
  // (#25/#30) la ca hai phai xong het thi moi coi la "het viec hom nay".
  const sameDay = await listAssignments(familyId, { childId, date: assignment.dueDate, includeChores: true });
  const stillTodo = sameDay.filter((a) => a.status === 'todo').length;
  const celebrate = assignment.dueDate === todayISO() && stillTodo <= 1;

  return (
    <ChiTietBai
      assignment={assignment}
      childId={childId}
      celebrate={celebrate}
      blobEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
    />
  );
}
