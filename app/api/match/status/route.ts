import { handleError, json, rateLimit, requireUser } from '@/lib/api';
import { matchmake } from '@/lib/match';

export const dynamic = 'force-dynamic';

// Polled by the chat page every few seconds. Doubles as a heartbeat: if a
// browser stops polling (tab closed, network lost), the server drops it from
// the queue after ~25s and ends its match after ~45s.
export async function GET() {
  try {
    const { user } = await requireUser({ allowRestricted: true });
    await rateLimit(`status:${user.id}`, 90, 60);
    const result = await matchmake(user.id, false);
    return json(result);
  } catch (err) {
    return handleError(err);
  }
}
