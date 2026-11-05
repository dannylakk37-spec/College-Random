import { PageShell } from '@/components/PageShell';
import { publicEnv } from '@/lib/env';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  const email = publicEnv.contactEmail();
  return (
    <PageShell title="Privacy Policy" subtitle="Last updated: November 2026 · Template — have a lawyer review before public launch.">
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account info:</strong> your username or first name, school email address, password (stored hashed by our auth provider), university, and date of birth.</li>
        <li><strong>Safety records:</strong> who you were matched with and when, blocks you make, and reports you file or receive.</li>
        <li><strong>Technical data:</strong> IP address and basic request logs used for security and rate limiting.</li>
      </ul>

      <h2>What we do NOT collect</h2>
      <ul>
        <li>We do not record, store or review the audio or video of your chats. Video flows through our real-time video provider only while the call is live.</li>
        <li>We never show your email address or date of birth to other students. Other students see only your username/first name and university.</li>
      </ul>

      <h2>Recording by other users</h2>
      <p>
        Even though we don’t record calls, another person could record their own screen with separate software
        without your knowledge. We can’t prevent that, so privacy during a chat can’t be guaranteed. Recording
        others without consent violates our Community Guidelines — please report it.
      </p>

      <h2>How we use your info</h2>
      <ul>
        <li>To verify you’re an adult student at an approved school.</li>
        <li>To match you with other students and keep blocked users away from you.</li>
        <li>To investigate reports and enforce our rules.</li>
        <li>To send account emails (verification and password reset). We don’t sell your data.</li>
      </ul>

      <h2>Service providers</h2>
      <p>
        We use Supabase (database and authentication), Daily (live video infrastructure) and Vercel (hosting).
        They process data on our behalf under their own security and privacy terms.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep account and safety records while your account is active and for a limited time afterward to handle
        abuse reports. To delete your account, email us at {email} from your school address.
      </p>

      <h2>Contact</h2>
      <p>Questions? Email {email}.</p>
    </PageShell>
  );
}
