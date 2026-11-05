'use client';

import { Logo } from '@/components/Logo';

// Client-side twin of AuthShell (AuthShell uses the server-only Navbar).
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="bg-grid min-h-screen bg-brand-50/30 px-5 py-10">
      <div className="mx-auto mb-10 flex max-w-md justify-center">
        <Logo onLight />
      </div>
      <div className="card mx-auto w-full max-w-md animate-fade-up p-8 sm:p-10">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-900/60">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </div>
    </main>
  );
}
