import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getProfile, type Profile } from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/env';
import type { User } from '@supabase/supabase-js';

/** For pages/components: who is logged in (or null). Never throws. */
export async function getCurrentUser(): Promise<{ user: User; profile: Profile | null } | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    let profile: Profile | null = null;
    try {
      profile = await getProfile(user.id);
    } catch {
      profile = null; // service key missing — pages will show a setup hint
    }
    return { user, profile };
  } catch {
    return null;
  }
}
