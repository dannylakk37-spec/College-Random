'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ResendButton } from '@/components/auth/ResendButton';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUnconfirmed(false);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      setLoading(false);
      if (/not confirmed/i.test(error.message)) {
        setUnconfirmed(true);
        setError('Verify your school email first — check your inbox for the link.');
      } else if (/invalid/i.test(error.message)) {
        setError('Wrong email or password.');
      } else {
        setError(error.message);
      }
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">School email</label>
        <input id="email" type="email" className="input" autoComplete="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="password">Password</label>
          <Link href="/forgot-password" className="mb-1.5 text-xs font-semibold text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <input id="password" type="password" className="input" autoComplete="current-password" required value={password}
          onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base">
        {loading ? 'Logging in…' : 'Log in'}
      </button>
      {unconfirmed && email && <ResendButton email={email.trim().toLowerCase()} />}
    </form>
  );
}
