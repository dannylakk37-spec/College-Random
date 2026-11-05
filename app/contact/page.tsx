import { PageShell } from '@/components/PageShell';
import { publicEnv } from '@/lib/env';

export const metadata = { title: 'Contact' };

export default function ContactPage() {
  const email = publicEnv.contactEmail();
  return (
    <PageShell title="Contact us" subtitle="We usually reply within 2 business days.">
      <div className="not-prose mt-2 grid gap-4 sm:grid-cols-2">
        {[
          { t: 'Request your school', d: 'Want your campus added? Send us the school name and its student email domain.', s: 'School request' },
          { t: 'Safety issue', d: 'Something serious happened? Include the date, time and the other person’s username.', s: 'Safety report' },
          { t: 'Account help', d: 'Can’t log in, didn’t get the verification email, or want your account deleted.', s: 'Account help' },
          { t: 'Everything else', d: 'Feedback, press, partnerships — we read everything.', s: 'Hello' },
        ].map((c) => (
          <a
            key={c.t}
            href={`mailto:${email}?subject=${encodeURIComponent(`[CollegeRandom] ${c.s}`)}`}
            className="card block p-6 transition hover:-translate-y-0.5 hover:border-brand-300"
          >
            <h3 className="font-display text-lg font-bold">{c.t}</h3>
            <p className="mt-2 text-sm text-ink-900/60">{c.d}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-brand-600">{email} →</span>
          </a>
        ))}
      </div>
      <p className="mt-8 text-sm">If someone is in immediate danger, call 911.</p>
    </PageShell>
  );
}
