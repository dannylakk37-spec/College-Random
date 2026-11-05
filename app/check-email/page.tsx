import Link from 'next/link';
import { AuthShell } from '@/components/PageShell';
import { ResendButton } from '@/components/auth/ResendButton';

export const metadata = { title: 'Check your email' };

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <AuthShell title="Check your school inbox 📬">
      <p className="text-sm leading-relaxed text-ink-900/70">
        We sent a verification link to <strong className="text-ink-900">{email || 'your school email'}</strong>. Click
        it to verify you’re a student — then you can start chatting.
      </p>
      <ul className="mt-5 space-y-2 text-sm text-ink-900/60">
        <li>• It can take a minute or two. Check spam / junk / quarantine folders.</li>
        <li>• Some schools filter outside emails — search for “CollegeRandom”.</li>
        <li>• The link expires after a while; you can request a new one below.</li>
      </ul>
      {email && <ResendButton email={email} />}
      <p className="mt-6 text-center text-sm text-ink-900/60">
        Already verified? <Link href="/login" className="font-semibold text-brand-600 hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
