import { type NextRequest } from 'next/server';
import { ApiError, assertSameOrigin, handleError, isUuid, json, readJson, requireAdmin } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { endMatchFor } from '@/lib/match';

export const dynamic = 'force-dynamic';

// GET /api/admin/users?q=search            → user list
// GET /api/admin/users?id=<uuid>           → one user + report & moderation history
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const id = req.nextUrl.searchParams.get('id');

    if (isUuid(id)) {
      const [users, reports, actions] = await Promise.all([
        admin.rpc('cr_admin_users', { p_search: id, p_limit: 1 }),
        admin.rpc('cr_admin_reports', { p_status: 'all', p_user: id }),
        admin
          .from('moderation_actions')
          .select('id, action, reason, created_at, admin_id')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (users.error) throw users.error;
      return json({
        user: (users.data as unknown[])?.[0] ?? null,
        reports: reports.data ?? [],
        actions: actions.data ?? [],
      });
    }

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100);
    const { data, error } = await admin.rpc('cr_admin_users', { p_search: q, p_limit: 100 });
    if (error) throw error;
    return json({ users: data ?? [] });
  } catch (err) {
    return handleError(err);
  }
}

// PATCH { userId, action: 'suspend'|'ban'|'reinstate', reason?, days? }
export async function PATCH(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { user } = await requireAdmin();
    const body = await readJson<{ userId?: string; action?: string; reason?: string; days?: number }>(req);
    if (!isUuid(body.userId)) throw new ApiError(400, 'Bad user id');
    if (body.userId === user.id) throw new ApiError(400, 'You can’t moderate your own account.');
    const reason = (body.reason ?? '').trim().slice(0, 500) || null;
    const admin = createAdminClient();

    let update: Record<string, unknown>;
    switch (body.action) {
      case 'suspend': {
        const days = Math.min(Math.max(Number(body.days) || 1, 1), 365);
        update = {
          status: 'suspended',
          suspended_until: new Date(Date.now() + days * 86_400_000).toISOString(),
          status_reason: reason ?? `Suspended for ${days} day(s)`,
        };
        break;
      }
      case 'ban':
        update = { status: 'banned', suspended_until: null, status_reason: reason ?? 'Banned' };
        break;
      case 'reinstate':
        update = { status: 'active', suspended_until: null, status_reason: null };
        break;
      default:
        throw new ApiError(400, 'Unknown action');
    }

    const { error } = await admin.from('profiles').update(update).eq('id', body.userId);
    if (error) throw error;
    await admin.from('moderation_actions').insert({
      user_id: body.userId,
      admin_id: user.id,
      action: body.action,
      reason,
    });

    // Kick them out of any chat right now.
    if (body.action !== 'reinstate') await endMatchFor(body.userId, 'moderation');

    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
