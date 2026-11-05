import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { Navbar } from '@/components/Navbar';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export const metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getCurrentUser();
  if (!session) redirect('/login?next=/admin');
  if (session.profile?.role !== 'admin') notFound(); // don't reveal the page exists

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Admin dashboard</h1>
        <p className="mt-1 text-sm text-ink-900/55">Moderate reports, manage accounts and control which school emails are accepted.</p>
        <AdminDashboard myId={session.user.id} />
      </main>
    </>
  );
}
