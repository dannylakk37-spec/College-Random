import { type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, assertSameOrigin, clientIp, handleError, isUuid, json, rateLimit, readJson } from '@/lib/api';
import { EMAIL_RE, USERNAME_RE, ageFromDob } from '@/lib/constants';
import { publicEnv } from '@/lib/env';

type Body = {
  username?: string;
  email?: string;
  password?: string;
  universityId?: string;
  dateOfBirth?: string;
  agree?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await rateLimit(`signup:ip:${clientIp(req)}`, 8, 60 * 60);

    const body = await readJson<Body>(req);
    const username = (body.username ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';
    const universityId = body.universityId ?? '';
    const dob = body.dateOfBirth ?? '';

    // ---- Validate input (the database trigger re-checks all of this) ----
    if (!USERNAME_RE.test(username)) {
      throw new ApiError(400, 'Username must be 3–20 characters: letters, numbers or underscores.');
    }
    if (!EMAIL_RE.test(email) || email.length > 254) throw new ApiError(400, 'Enter a valid email address.');
    if (password.length < 8 || password.length > 72) {
      throw new ApiError(400, 'Password must be 8–72 characters.');
    }
    if (!isUuid(universityId)) throw new ApiError(400, 'Choose your university.');
    const age = ageFromDob(dob);
    if (age === null || age > 120) throw new ApiError(400, 'Enter a valid date of birth.');
    if (age < 18) throw new ApiError(403, 'You must be 18 or older to use CollegeRandom.');
    if (body.agree !== true) {
      throw new ApiError(400, 'You must agree to the Terms of Service and Privacy Policy.');
    }

    const admin = createAdminClient();
    const domain = email.split('@')[1];

    // ---- Is this email domain approved for the chosen university? ----
    const [{ data: isAdminEmail }, { data: allowed }, { data: usernameFree }] = await Promise.all([
      admin.from('admin_emails').select('email').eq('email', email).maybeSingle(),
      admin.rpc('cr_domain_allowed', { p_domain: domain, p_university: universityId }),
      admin.rpc('cr_username_available', { p_username: username }),
    ]);

    if (!isAdminEmail && allowed !== true) {
      throw new ApiError(
        400,
        'That email isn’t an approved address for the university you picked. Use your official school email, or contact us to add your school.',
        'domain_not_approved',
      );
    }
    if (usernameFree !== true) throw new ApiError(409, 'That username is taken. Try another.', 'username_taken');

    // ---- Create the auth user (Supabase sends the verification email) ----
    const anon = createClient(publicEnv.supabaseUrl(), publicEnv.supabaseAnonKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${publicEnv.siteUrl()}/auth/confirm`,
        data: { username, university_id: universityId, date_of_birth: dob },
      },
    });

    if (error) {
      const msg = error.message || '';
      console.error('[signup] supabase error', error.status, msg);
      if (/rate limit/i.test(msg)) {
        throw new ApiError(429, 'Too many sign-up emails right now. Please try again in a little while.');
      }
      if (/password/i.test(msg)) throw new ApiError(400, msg);
      if (/database error/i.test(msg)) {
        throw new ApiError(400, 'We couldn’t create that account. Check your details (or the username may have just been taken).');
      }
      throw new ApiError(400, 'Could not create account. Please try again.');
    }

    // Supabase deliberately returns success for already-registered emails
    // (so attackers can't discover who has an account). Same message either way.
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
