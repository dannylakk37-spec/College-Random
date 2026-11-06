import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';

// Service-role client. BYPASSES Row Level Security.
// `server-only` makes the build fail if this file is ever imported into
// browser code, so the secret key can't leak.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cached: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): any {
  if (cached) return cached;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local / Vercel env vars (never with NEXT_PUBLIC_).',
    );
  }
  cached = createClient(publicEnv.supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
