import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { publicEnv } from '@/lib/env';

export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <PageShell title="Terms of Service" subtitle="Last updated: November 2026 · Template — have a lawyer review before public launch.">
      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old and a current student at a college or university whose email domain we
        accept. You agree that the information you provide (including your date of birth and school) is true.
      </p>

      <h2>2. Your account</h2>
      <p>
        Keep your password secure. You’re responsible for activity on your account. One account per person. We may
        ask you to re-verify your school email at any time.
      </p>

      <h2>3. Acceptable use</h2>
      <p>
        You agree to follow the <Link href="/guidelines" className="text-brand-600 underline">Community Guidelines</Link>.
        We may suspend or permanently ban accounts that break them, at our discretion and without notice.
      </p>

      <h2>4. Live content and recording</h2>
      <p>
        Chats are live and unmoderated in real time. You may see content you find offensive; use Next, Report and
        Block. CollegeRandom does not record calls, but other users could record their screens, so you use the
        service understanding that privacy cannot be guaranteed. You must not record others without their consent.
      </p>

      <h2>5. Free service</h2>
      <p>
        Basic video chat is free. We may add optional paid features in the future; any such features will be clearly
        labeled and never required for basic chatting.
      </p>

      <h2>6. Disclaimers</h2>
      <p>
        The service is provided “as is” without warranties. We aren’t responsible for the conduct of users. To the
        fullest extent permitted by law, our liability is limited to the amount you paid us in the last 12 months
        (which, for free users, is $0).
      </p>

      <h2>7. Not affiliated with schools</h2>
      <p>CollegeRandom is independent and not affiliated with or endorsed by any college or university.</p>

      <h2>8. Contact</h2>
      <p>Email {publicEnv.contactEmail()}.</p>
    </PageShell>
  );
}
