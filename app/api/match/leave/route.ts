import { type NextRequest } from 'next/server';
import { assertSameOrigin, handleError, json, requireUser } from '@/lib/api';
import { endMatchFor } from '@/lib/match';

// "Disconnect", "Stop searching", and the beacon sent when a tab closes.
// Ends the match for BOTH people (the Daily room is deleted).
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { user } = await requireUser({ allowRestricted: true });
    await endMatchFor(user.id, 'disconnect');
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
