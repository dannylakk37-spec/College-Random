import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/PageShell';
import { LoginForm } from '@/components/auth/LoginForm';
import { getCurrentUser } from '@/lib/session';

export const metadata = { title: 'Log in' };

function safeNext(next?: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/chat';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; verified?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const session = await getCurrentUser();
  if (session) redirect(next);

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        <>
          New here?{' '}
          <Link href="/signup" className="font-semibold text-brand-600 hover:underline">
            Create a free account
          </Link>
        </>
      }
    >
      {sp.error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {sp.error === 'link'
            ? 'That link is invalid or has expired. Request a new one.'
            : 'Something went wrong. Please try again.'}
        </p>
      )}
      {sp.reset && <p className="mb-4 rounded-xl bg-mint-500/10 p-3 text-sm text-emerald-800">Password updated. Log in with your new password.</p>}
      <LoginForm next={next} />
    </AuthShell>
  );
}
