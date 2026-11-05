import Link from 'next/link';

/**
 * CollegeRandom logo: graduation-cap chat bubbles + wordmark.
 * The icon is white/blue, so it needs a dark background:
 *  - default: for dark/navy backgrounds (navbar, chat screen)
 *  - onLight: puts the icon on a navy tile and uses dark text
 */
export function Logo({ onLight = false, dark: _dark }: { onLight?: boolean; dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="CollegeRandom home">
      {onLight ? (
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-950">
          <img src="/logo-icon.png" alt="" width={28} height={19} className="h-auto w-7" />
        </span>
      ) : (
        <img src="/logo-icon.png" alt="" width={46} height={32} className="h-8 w-auto" />
      )}
      <span className={`font-display text-xl font-extrabold tracking-tight ${onLight ? 'text-ink-900' : 'text-white'}`}>
        College<span className="text-brand-500">Random</span>
      </span>
    </Link>
  );
}
