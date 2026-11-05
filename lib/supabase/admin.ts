import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';

// Service-role client. BYPASSES Row Level Security.
// `server-only` makes the build fail if this file is ever imported into
// browser code, so the secret key can't leak.
let cached: ReturnType<typeof createClient> | null = null;

export function createAdminClient() {
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
