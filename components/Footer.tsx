import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-ink-900/[.06]">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-ink-900/50 sm:flex-row">
        <p>© {new Date().getFullYear()} CollegeRandom · Not affiliated with any college</p>
        <nav className="flex gap-5">
          <Link href="/guidelines" className="hover:text-ink-900">Guidelines</Link>
          <Link href="/privacy" className="hover:text-ink-900">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-ink-900">Terms of Service</Link>
          <Link href="/contact" className="hover:text-ink-900">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
