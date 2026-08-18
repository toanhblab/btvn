import { redirect } from 'next/navigation';

/** Mo web len la vao thang man cua con — day la nguoi dung chinh (PRD muc 6). */
export default function Home() {
  redirect('/con');
}
