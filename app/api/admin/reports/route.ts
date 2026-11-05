import { type NextRequest } from 'next/server';
import { ApiError, assertSameOrigin, handleError, isUuid, json, readJson, requireAdmin } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/reports?status=open|actioned|dismissed|all&userId=<uuid>
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const status = req.nextUrl.searchParams.get('status') ?? 'open';
    const userId = req.nextUrl.searchParams.get('userId');
    if (!['open', 'actioned', 'dismissed', 'all'].includes(status)) throw new ApiError(400, 'Bad status');
    const { data, error } = await createAdminClient().rpc('cr_admin_reports', {
      p_status: status,
      p_user: isUuid(userId) ? userId : null,
    });
    if (error) throw error;
    return json({ reports: data ?? [] });
  } catch (err) {
    return handleError(err);
  }
}

// PATCH { id, status: 'actioned'|'dismissed'|'open', notes? }
export async function PATCH(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { user } = await requireAdmin();
    const body = await readJson<{ id?: string; status?: string; notes?: string }>(req);
    if (!isUuid(body.id)) throw new ApiError(400, 'Bad id');
    if (!['open', 'actioned', 'dismissed'].includes(body.status ?? '')) throw new ApiError(400, 'Bad status');
    const { error } = await createAdminClient()
      .from('reports')
      .update({
        status: body.status,
        admin_notes: body.notes?.slice(0, 1000) ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', body.id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
