import { handleError, json, requireAdmin } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await createAdminClient().rpc('cr_admin_stats');
    if (error) throw error;
    return json(data);
  } catch (err) {
    return handleError(err);
  }
}
