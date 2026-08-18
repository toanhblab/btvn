import { notFound } from 'next/navigation';
import { getAssignment, getChild, listAssignments, todayISO } from '@/lib/store';
import ChiTietBai from './ChiTietBai';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ childId: string; id: string }>;
}) {
  const { childId, id } = await params;
  const [child, assignment] = await Promise.all([getChild(childId), getAssignment(id)]);

  if (!child || !assignment || assignment.childId !== childId) notFound();

  // Man chuc mung chi danh cho bai CUOI CUNG CUA HOM NAY: danh sach gio co ca bai
  // ngay mai, khen "lam het bai hom nay" khi con moi lam bai ngay mai thi sai.
  const sameDay = await listAssignments({ childId, date: assignment.dueDate });
  const stillTodo = sameDay.filter((a) => a.status === 'todo').length;
  const celebrate = assignment.dueDate === todayISO() && stillTodo <= 1;

  return <ChiTietBai assignment={assignment} childId={childId} celebrate={celebrate} />;
}
