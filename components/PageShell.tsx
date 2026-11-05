import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-3 text-ink-900/55">{subtitle}</p>}
        <div className="prose-page mt-8">{children}</div>
      </main>
      <Footer />
    </>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="bg-grid min-h-[calc(100vh-4rem)] bg-brand-50/30 px-5 py-14">
        <div className="card mx-auto w-full max-w-md animate-fade-up p-8 sm:p-10">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-ink-900/60">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </>
  );
}
