import 'server-only';

// Server-side helpers for Daily's REST API (https://docs.daily.co/reference/rest-api).
// The API key is read from process.env on the server and never sent to browsers.

const DAILY_API = 'https://api.daily.co/v1';

function apiKey(): string {
  const key = process.env.DAILY_API_KEY;
  if (!key) {
    throw new Error('Missing DAILY_API_KEY. Add it to .env.local / Vercel env vars.');
  }
  return key;
}

async function daily(path: string, init: RequestInit = {}) {
  return fetch(`${DAILY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Creates a private 2-person room (idempotent: both students call this, the
 * second call just looks the room up). No recording is enabled.
 */
export async function ensureRoom(name: string): Promise<string> {
  const res = await daily('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name,
      privacy: 'private', // a meeting token is required to join
      properties: {
        exp: nowSeconds() + 60 * 60, // room self-destructs after 1 hour
        eject_at_room_exp: true,
        max_participants: 2,
        enable_chat: false,
        enable_screenshare: false,
      },
    }),
  });

  if (res.ok) {
    const room = (await res.json()) as { url: string };
    return room.url;
  }

  const body = await res.text();
  if (res.status === 400 && /already exists/i.test(body)) {
    const existing = await daily(`/rooms/${encodeURIComponent(name)}`);
    if (existing.ok) return ((await existing.json()) as { url: string }).url;
  }
  console.error('[daily] create room failed', res.status, body);
  throw new Error('Could not create video room');
}

/** Short-lived (5 min to join) meeting token tied to one room and one user. */
export async function createMeetingToken(opts: {
  roomName: string;
  userId: string;
  userName: string;
}): Promise<string> {
  const res = await daily('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: opts.roomName,
        user_id: opts.userId,
        user_name: opts.userName,
        is_owner: false,
        exp: nowSeconds() + 5 * 60,
      },
    }),
  });
  if (!res.ok) {
    console.error('[daily] token failed', res.status, await res.text());
    throw new Error('Could not create meeting token');
  }
  return ((await res.json()) as { token: string }).token;
}

/** Deleting the room immediately disconnects everyone inside it. */
export async function deleteRoom(name: string): Promise<void> {
  try {
    const res = await daily(`/rooms/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      console.error('[daily] delete room failed', res.status, await res.text());
    }
  } catch (e) {
    console.error('[daily] delete room error', e);
  }
}

export async function deleteRooms(names: (string | null | undefined)[]) {
  await Promise.all(names.filter((n): n is string => Boolean(n)).map(deleteRoom));
}
