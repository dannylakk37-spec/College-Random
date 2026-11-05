import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { isSupabaseConfigured } from '@/lib/env';

type Uni = { name: string; short_name: string | null };

async function getUniversities(): Promise<Uni[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data } = await supabase.from('universities').select('name, short_name').order('name');
    return (data as Uni[]) ?? [];
  } catch {
    return [];
  }
}

const steps = [
  ['Sign up', 'with your college email.'],
  ['Verify', 'by clicking the link we email you.'],
  ['Start Chat', 'and meet a random student. Tap Next anytime.'],
];

export default async function HomePage() {
  const universities = await getUniversities();

  return (
    <>
      <Navbar />
      <main>
        {/* One-screen hero */}
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center px-5 py-16 text-center">
          <p className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            Verified college students only · 18+ · Free
          </p>
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Meet College Students From Across America.
          </h1>
          <p className="mt-5 text-lg text-ink-900/60">
            Random video chats with real, verified college students. One click to start, one click for someone new.
          </p>
          <Link href="/chat" className="btn-primary mt-10 px-14 py-5 text-xl shadow-glow">
            Start Chatting
          </Link>
          <p className="mt-4 text-sm text-ink-900/45">
            New here?{' '}
            <Link href="/signup" className="font-semibold text-brand-600 hover:underline">
              Sign up with your school email
            </Link>
          </p>

          {/* How it works */}
          <ol className="mt-16 grid w-full gap-6 text-left sm:grid-cols-3">
            {steps.map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-sm text-ink-900/65">
                  <strong className="text-ink-900">{title}</strong> {body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Why + schools, kept to a few lines */}
        <section className="border-t border-ink-900/[.06] bg-ink-900/[.02] px-5 py-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm text-ink-900/60">
              Students only · Free to use · Your email is never shown · Calls are never recorded · Report &amp; block in one tap
            </p>
            {universities.length > 0 && (
              <>
                <h2 className="mt-10 text-sm font-semibold text-ink-900">Open to students at</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-900/55">
                  {universities.map((u) => u.short_name || u.name).join(' · ')}
                </p>
              </>
            )}
            <p className="mt-3 text-xs text-ink-900/40">
              Don’t see your school?{' '}
              <Link href="/contact" className="underline hover:text-ink-900">
                Ask us to add it
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
