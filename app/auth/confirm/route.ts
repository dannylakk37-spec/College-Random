import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Handles the links in Supabase emails (sign-up verification + password reset).
// Email templates must point here — see README "Email templates".
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const dest = next ?? (type === 'recovery' ? '/reset-password' : '/chat?welcome=1');
      return NextResponse.redirect(`${origin}${dest}`);
    }
    console.error('[auth/confirm] verifyOtp failed', error.message);
  } else if (code) {
    // Fallback for the default (PKCE) templates when the link is opened in the same browser
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next ?? '/chat?welcome=1'}`);
    console.error('[auth/confirm] exchangeCode failed', error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
