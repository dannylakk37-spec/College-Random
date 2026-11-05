import { type NextRequest } from 'next/server';
import { ApiError, assertSameOrigin, handleError, isUuid, json, readJson, requireAdmin } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

// GET → all universities with their domains
export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await createAdminClient()
      .from('universities')
      .select('id, name, short_name, state, active, approved_domains(domain, allow_subdomains, active, notes)')
      .order('name');
    if (error) throw error;
    return json({ universities: data ?? [] });
  } catch (err) {
    return handleError(err);
  }
}

// POST { domain, universityId?  OR  universityName, shortName?, state?,  allowSubdomains? }
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await requireAdmin();
    const admin = createAdminClient();
    const body = await readJson<{
      domain?: string;
      universityId?: string;
      universityName?: string;
      shortName?: string;
      state?: string;
      allowSubdomains?: boolean;
    }>(req);

    const domain = (body.domain ?? '').trim().toLowerCase().replace(/^@/, '');
    if (!DOMAIN_RE.test(domain)) throw new ApiError(400, 'Enter a valid domain like university.edu');
    if (['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com', 'aol.com'].includes(domain)) {
      throw new ApiError(400, 'Personal email providers can’t be approved.');
    }

    let universityId = body.universityId;
    if (!isUuid(universityId)) {
      const name = (body.universityName ?? '').trim();
      if (name.length < 3) throw new ApiError(400, 'Pick an existing university or enter a new university name.');
      const { data, error } = await admin
        .from('universities')
        .upsert(
          {
            name,
            short_name: body.shortName?.trim() || null,
            state: body.state?.trim().toUpperCase().slice(0, 2) || null,
          },
          { onConflict: 'name' },
        )
        .select('id')
        .single();
      if (error) throw error;
      universityId = (data as { id: string }).id;
    }

    const { error } = await admin.from('approved_domains').insert({
      domain,
      university_id: universityId,
      allow_subdomains: body.allowSubdomains !== false,
    });
    if (error) {
      if (error.code === '23505') throw new ApiError(409, 'That domain is already on the list.');
      throw error;
    }
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

// PATCH { domain, active?, allowSubdomains? }  or  { universityId, active }
export async function PATCH(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await requireAdmin();
    const admin = createAdminClient();
    const body = await readJson<{ domain?: string; active?: boolean; allowSubdomains?: boolean; universityId?: string }>(req);

    if (body.universityId) {
      if (!isUuid(body.universityId) || typeof body.active !== 'boolean') throw new ApiError(400, 'Bad request');
      const { error } = await admin.from('universities').update({ active: body.active }).eq('id', body.universityId);
      if (error) throw error;
      return json({ ok: true });
    }

    const update: Record<string, boolean> = {};
    if (typeof body.active === 'boolean') update.active = body.active;
    if (typeof body.allowSubdomains === 'boolean') update.allow_subdomains = body.allowSubdomains;
    if (!body.domain || Object.keys(update).length === 0) throw new ApiError(400, 'Nothing to update');
    const { error } = await admin.from('approved_domains').update(update).eq('domain', body.domain.toLowerCase());
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE ?domain=example.edu
export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await requireAdmin();
    const domain = (req.nextUrl.searchParams.get('domain') ?? '').toLowerCase();
    if (!DOMAIN_RE.test(domain)) throw new ApiError(400, 'Bad domain');
    const { error } = await createAdminClient().from('approved_domains').delete().eq('domain', domain);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
