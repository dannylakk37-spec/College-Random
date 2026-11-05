import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type Profile = {
  id: string;
  username: string;
  university_id: string | null;
  role: 'student' | 'admin';
  status: 'active' | 'suspended' | 'banned';
  suspended_until: string | null;
  status_reason: string | null;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function handleError(err: unknown) {
  if (err instanceof ApiError) {
    return json({ error: err.message, code: err.code }, err.status);
  }
  console.error('[api] unexpected error', err);
  return json({ error: 'Something went wrong. Please try again.' }, 500);
}

/** Reject cross-site POSTs (CSRF defence in addition to SameSite cookies). */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return; // some browsers omit it on same-origin beacons
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    if (new URL(origin).host !== host) throw new ApiError(403, 'Cross-site request blocked.');
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(403, 'Invalid origin.');
  }
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/** Throws 429 if the caller exceeded `max` actions in `windowSeconds`. */
export async function rateLimit(key: string, max: number, windowSeconds: number) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('cr_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('[rateLimit] failed', error);
    return; // fail open rather than locking everyone out
  }
  if (data === false) {
    throw new ApiError(429, 'Too many requests. Slow down and try again in a minute.', 'rate_limited');
  }
}

export function isRestricted(profile: Profile): { restricted: boolean; message?: string } {
  if (profile.status === 'banned') {
    return { restricted: true, message: 'This account has been banned for violating the Community Guidelines.' };
  }
  if (profile.status === 'suspended') {
    const until = profile.suspended_until ? new Date(profile.suspended_until) : null;
    if (!until || until > new Date()) {
      return {
        restricted: true,
        message: until
          ? `This account is suspended until ${until.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET.`
          : 'This account is suspended pending review.',
      };
    }
  }
  return { restricted: false };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('id, username, university_id, role, status, suspended_until, status_reason')
    .eq('id', userId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

/**
 * Verifies the session with Supabase (getUser() validates the JWT on the
 * Supabase server — never trust getSession() on the server).
 */
export async function requireUser(opts: { allowRestricted?: boolean } = {}): Promise<{
  user: User;
  profile: Profile;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, 'Please log in first.', 'unauthenticated');
  if (!user.email_confirmed_at) {
    throw new ApiError(403, 'Please verify your college email first.', 'unverified');
  }
  const profile = await getProfile(user.id);
  if (!profile) throw new ApiError(403, 'Profile not found. Contact support.', 'no_profile');
  if (!opts.allowRestricted) {
    const r = isRestricted(profile);
    if (r.restricted) throw new ApiError(403, r.message!, 'restricted');
  }
  return { user, profile };
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.profile.role !== 'admin') throw new ApiError(403, 'Admins only.', 'forbidden');
  return ctx;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    const text = await req.text();
    if (!text) return {} as T;
    if (text.length > 10_000) throw new ApiError(413, 'Request too large.');
    return JSON.parse(text) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, 'Invalid JSON body.');
  }
}
