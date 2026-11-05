import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { getCurrentUser } from '@/lib/session';

export async function Navbar() {
  const session = await getCurrentUser();
  const isAdmin = session?.profile?.role === 'admin';

  return (
    <header className="bg-ink-950">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Logo />
        <div className="flex items-center gap-1">
          {session ? (
            <>
              {isAdmin && <Link href="/admin" className="btn text-white/80 hover:bg-white/10 hover:text-white">Admin</Link>}
              <form action="/auth/signout" method="post">
                <button className="btn text-white/80 hover:bg-white/10 hover:text-white" type="submit">Log out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn text-white/80 hover:bg-white/10 hover:text-white">Log in</Link>
              <Link href="/signup" className="btn-primary">Sign up</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
