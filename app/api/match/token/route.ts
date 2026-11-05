import { type NextRequest } from 'next/server';
import { ApiError, assertSameOrigin, handleError, isUuid, json, rateLimit, readJson, requireUser } from '@/lib/api';
import { matchInfo } from '@/lib/match';
import { createMeetingToken, ensureRoom } from '@/lib/daily';

// Returns the Daily room URL + a short-lived meeting token for ONE active match
// the caller belongs to. The Daily API key never leaves the server.
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { user, profile } = await requireUser();
    await rateLimit(`token:${user.id}`, 20, 60);

    const { matchId } = await readJson<{ matchId?: string }>(req);
    if (!isUuid(matchId)) throw new ApiError(400, 'Invalid match.');

    const info = await matchInfo(user.id, matchId);
    if (!info || info.match_status !== 'active') {
      throw new ApiError(409, 'This chat has already ended.', 'match_ended');
    }

    const url = await ensureRoom(info.room_name);
    const token = await createMeetingToken({
      roomName: info.room_name,
      userId: user.id,
      userName: profile.username,
    });
    return json({ url, token });
  } catch (err) {
    return handleError(err);
  }
}
