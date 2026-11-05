import { type NextRequest } from 'next/server';
import { assertSameOrigin, handleError, json, rateLimit, requireUser } from '@/lib/api';
import { endMatchFor, matchmake } from '@/lib/match';

// "Start Chat" and "Next": leave any current chat, join the queue, try to match.
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser();
    await rateLimit(`join:${user.id}`, 40, 60);

    await endMatchFor(user.id, 'next');
    const result = await matchmake(user.id, true);
    return json(result);
  } catch (err) {
    return handleError(err);
  }
}
