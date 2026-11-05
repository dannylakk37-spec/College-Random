import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { AuthShell } from '@/components/PageShell';
import { SignupForm } from '@/components/auth/SignupForm';
import { isSupabaseConfigured } from '@/lib/env';
import { getCurrentUser } from '@/lib/session';

export const metadata = { title: 'Create your account' };

async function loadUniversities() {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await supabase.from('universities').select('id, name, state').order('name');
  return (data as { id: string; name: string; state: string | null }[]) ?? [];
}

export default async function SignupPage() {
  const session = await getCurrentUser();
  if (session) redirect('/chat');
  const universities = await loadUniversities();

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured() && (
        <p className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Setup needed: add your Supabase keys to <code>.env.local</code> (see README).
        </p>
      )}
      <SignupForm universities={universities} />
    </AuthShell>
  );
}
