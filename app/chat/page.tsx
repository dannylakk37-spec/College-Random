import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { isRestricted } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { ChatClient } from '@/components/chat/ChatClient';
import { Logo } from '@/components/Logo';

export const metadata = { title: 'Video chat' };
export const dynamic = 'force-dynamic';

function Notice({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-5 text-white">
      <div className="max-w-md text-center">
        <div className="mb-8 flex justify-center"><Logo dark /></div>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <div className="mt-3 text-white/65">{body}</div>
        <Link href="/" className="btn-dark mt-8">Back to home</Link>
      </div>
    </main>
  );
}

export default async function ChatPage() {
  const session = await getCurrentUser();
  if (!session) redirect('/login?next=/chat');

  if (!session.user.email_confirmed_at) {
    return <Notice title="Verify your email" body="Click the link we sent to your school email, then come back." />;
  }
  if (!session.profile) {
    return (
      <Notice
        title="Almost there"
        body="Your profile couldn’t be loaded. If you’re the site owner, check SUPABASE_SERVICE_ROLE_KEY and that schema.sql ran (see README)."
      />
    );
  }
  const r = isRestricted(session.profile);
  if (r.restricted) {
    return <Notice title="Account restricted" body={<>{r.message} Questions? <Link className="underline" href="/contact">Contact us</Link>.</>} />;
  }

  let university = 'CollegeRandom Team';
  if (session.profile.university_id) {
    const { data } = await createAdminClient()
      .from('universities')
      .select('name')
      .eq('id', session.profile.university_id)
      .maybeSingle();
    if (data?.name) university = data.name as string;
  }

  return (
    <ChatClient
      me={{ username: session.profile.username, university }}
      isAdmin={session.profile.role === 'admin'}
    />
  );
}
