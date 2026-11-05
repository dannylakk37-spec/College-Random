'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });
    setLoading(false);
    if (error && !/not found/i.test(error.message)) {
      setError(/seconds|rate/i.test(error.message) ? 'Please wait a minute before trying again.' : error.message);
      return;
    }
    setSent(true); // same message whether or not the account exists
  }

  return (
    <AuthCard title="Reset your password" subtitle="We’ll email you a secure link to choose a new one.">
      {sent ? (
        <div className="space-y-4 text-sm text-ink-900/70">
          <p>If an account exists for <strong>{email}</strong>, a reset link is on its way. Check spam too.</p>
          <Link href="/login" className="btn-outline w-full">Back to log in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">School email</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full py-3.5" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
          <p className="text-center text-sm"><Link href="/login" className="text-brand-600 hover:underline">Back to log in</Link></p>
        </form>
      )}
    </AuthCard>
  );
}
