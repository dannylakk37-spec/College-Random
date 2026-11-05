'use client';

import { createBrowserClient } from '@supabase/ssr';

// Browser Supabase client. Uses ONLY the public anon key.
// RLS means it can read universities and the user's own profile — nothing else.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
