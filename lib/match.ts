import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteRooms } from '@/lib/daily';

export type MatchStatus =
  | { status: 'idle' }
  | { status: 'waiting' }
  | { status: 'forbidden' }
  | { status: 'matched'; match: { id: string; partner: { username: string; university: string } } };

type MatchInfoRow = {
  match_id: string;
  room_name: string;
  match_status: 'active' | 'ended';
  created_at: string;
  partner_id: string;
  partner_username: string;
  partner_university: string;
};

export async function matchInfo(userId: string, matchId: string): Promise<MatchInfoRow | null> {
  const { data, error } = await createAdminClient().rpc('cr_match_info', { p_user: userId, p_match: matchId });
  if (error) throw error;
  const rows = (data as MatchInfoRow[] | null) ?? [];
  return rows[0] ?? null;
}

/** Calls the atomic Postgres matchmaker and attaches safe partner details. */
export async function matchmake(userId: string, enqueue: boolean): Promise<MatchStatus> {
  const { data, error } = await createAdminClient().rpc('cr_matchmake', { p_user: userId, p_enqueue: enqueue });
  if (error) throw error;
  const result = data as { status: string; match_id?: string };

  if (result.status === 'matched' && result.match_id) {
    const info = await matchInfo(userId, result.match_id);
    if (info && info.match_status === 'active') {
      return {
        status: 'matched',
        match: {
          id: info.match_id,
          partner: { username: info.partner_username, university: info.partner_university },
        },
      };
    }
    return { status: 'waiting' };
  }
  if (result.status === 'waiting' || result.status === 'idle' || result.status === 'forbidden') {
    return { status: result.status };
  }
  return { status: 'idle' };
}

/** Ends the user's active match (if any) and deletes the Daily room, which kicks BOTH people out. */
export async function endMatchFor(userId: string, reason: string) {
  const { data, error } = await createAdminClient().rpc('cr_end_match', { p_user: userId, p_reason: reason });
  if (error) throw error;
  await deleteRooms((data as string[] | null) ?? []);
}

/**
 * Finds the partner in a match the user was part of. Used by report/block,
 * so the client never gets to choose WHO is being reported — only which of
 * their own recent matches.
 */
export async function partnerFromMatch(userId: string, matchId: string, maxAgeMinutes = 30) {
  const info = await matchInfo(userId, matchId);
  if (!info) return null;
  const ageMs = Date.now() - new Date(info.created_at).getTime();
  if (ageMs > maxAgeMinutes * 60_000) return null;
  return info;
}
