import { type NextRequest } from 'next/server';
import { ApiError, assertSameOrigin, handleError, isUuid, json, rateLimit, readJson, requireUser } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { endMatchFor, partnerFromMatch } from '@/lib/match';

// Block the person from one of your recent chats. You'll never be matched again.
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ allowRestricted: true });
    await rateLimit(`block:${user.id}`, 30, 60 * 60);

    const { matchId } = await readJson<{ matchId?: string }>(req);
    if (!isUuid(matchId)) throw new ApiError(400, 'Invalid chat.');

    const info = await partnerFromMatch(user.id, matchId);
    if (!info) throw new ApiError(404, 'You can only block people from your recent chats.');

    const { error } = await createAdminClient()
      .from('blocks')
      .upsert({ blocker_id: user.id, blocked_id: info.partner_id }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
    if (error) throw error;

    if (info.match_status === 'active') await endMatchFor(user.id, 'blocked');
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
