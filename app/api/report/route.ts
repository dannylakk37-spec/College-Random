import { type NextRequest } from 'next/server';
import { ApiError, assertSameOrigin, handleError, isUuid, json, rateLimit, readJson, requireUser } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { endMatchFor, partnerFromMatch } from '@/lib/match';
import { REPORT_REASONS } from '@/lib/constants';

const VALID = new Set<string>(REPORT_REASONS.map((r) => r.value));

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ allowRestricted: true });
    await rateLimit(`report:${user.id}`, 10, 60 * 60);

    const body = await readJson<{ matchId?: string; reason?: string; details?: string; block?: boolean }>(req);
    if (!isUuid(body.matchId)) throw new ApiError(400, 'Invalid chat.');
    if (!body.reason || !VALID.has(body.reason)) throw new ApiError(400, 'Choose a reason.');
    const details = (body.details ?? '').toString().trim().slice(0, 1000) || null;

    const info = await partnerFromMatch(user.id, body.matchId);
    if (!info) throw new ApiError(404, 'You can only report people from your recent chats.');

    const admin = createAdminClient();
    const { error } = await admin.from('reports').insert({
      reporter_id: user.id,
      reported_id: info.partner_id,
      match_id: info.match_id,
      reason: body.reason,
      details,
    });
    if (error && error.code !== '23505') throw error; // 23505 = already reported this chat

    if (body.block) {
      await admin
        .from('blocks')
        .upsert({ blocker_id: user.id, blocked_id: info.partner_id }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
    }

    // Reporting always ends the chat (if still running).
    if (info.match_status === 'active') await endMatchFor(user.id, 'reported');

    return json({ ok: true, alreadyReported: error?.code === '23505' });
  } catch (err) {
    return handleError(err);
  }
}
