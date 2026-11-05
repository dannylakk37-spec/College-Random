import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteRooms } from '@/lib/daily';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // Leave any chat/queue before logging out.
    try {
      const { data } = await createAdminClient().rpc('cr_end_match', { p_user: user.id, p_reason: 'logout' });
      await deleteRooms((data as string[] | null) ?? []);
    } catch (e) {
      console.error('[signout] cleanup failed', e);
    }
  }
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
