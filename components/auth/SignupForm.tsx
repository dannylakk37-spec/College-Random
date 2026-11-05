'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EMAIL_RE, USERNAME_RE, ageFromDob } from '@/lib/constants';

type Uni = { id: string; name: string; state: string | null };

export function SignupForm({ universities }: { universities: Uni[] }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [dob, setDob] = useState('');
  const [agree, setAgree] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Latest date of birth that is 18+ today (for the date picker max)
  const maxDob = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().slice(0, 10);
  }, []);

  function validate(): string | null {
    if (!USERNAME_RE.test(username.trim())) return 'Username must be 3–20 letters, numbers or underscores.';
    if (!EMAIL_RE.test(email.trim())) return 'Enter your school email address.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!universityId) return 'Choose your university.';
    const age = ageFromDob(dob);
    if (age === null) return 'Enter your date of birth.';
    if (age < 18) return 'You must be 18 or older to use CollegeRandom.';
    if (!agree) return 'Please agree to the Terms and Privacy Policy.';
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) return setError(v);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password, universityId, dateOfBirth: dob, agree }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Sign-up failed.');
      router.push(`/check-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label className="label" htmlFor="username">First name or username</label>
        <input id="username" className="input" autoComplete="username" maxLength={20} value={username}
          onChange={(e) => setUsername(e.target.value)} placeholder="e.g. jordan_m" />
      </div>

      <div>
        <label className="label" htmlFor="email">School email</label>
        <input id="email" type="email" className="input" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" />
        <p className="mt-1 text-xs text-ink-900/45">Never shown to other students.</p>
      </div>

      <div>
        <label className="label" htmlFor="university">University or college</label>
        <select id="university" className="input" value={universityId} onChange={(e) => setUniversityId(e.target.value)}>
          <option value="">Select your school…</option>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}{u.state ? ` (${u.state})` : ''}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-900/45">
          School not listed? <Link href="/contact" className="text-brand-600 hover:underline">Request it</Link>.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="dob">Date of birth</label>
        <input id="dob" type="date" className="input" max={maxDob} min="1900-01-01" value={dob}
          onChange={(e) => setDob(e.target.value)} />
      </div>

      <div>
        <label className="label" htmlFor="password">Password</label>
        <div className="relative">
          <input id="password" type={showPw ? 'text' : 'password'} className="input pr-16" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          <button type="button" onClick={() => setShowPw((s) => !s)}
            className="absolute inset-y-0 right-3 my-auto h-8 rounded-lg px-2 text-xs font-semibold text-ink-900/55 hover:bg-ink-900/5">
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm text-ink-900/70">
        <input type="checkbox" className="mt-1 h-4 w-4 rounded border-ink-900/30 accent-brand-500" checked={agree}
          onChange={(e) => setAgree(e.target.checked)} />
        <span>
          I’m 18+ and agree to the{' '}
          <Link href="/terms" target="_blank" className="font-medium text-brand-600 hover:underline">Terms</Link> and{' '}
          <Link href="/privacy" target="_blank" className="font-medium text-brand-600 hover:underline">Privacy Policy</Link>.
        </span>
      </label>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base">
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
