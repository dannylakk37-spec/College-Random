-- =====================================================================
-- CollegeRandom — database schema
-- Run this whole file once in Supabase: Dashboard → SQL Editor → New query
-- → paste → Run. Then run seed.sql.
--
-- Security model
--   * Row Level Security (RLS) is ON for every table.
--   * The browser (anon / authenticated roles) can only read:
--       - active universities (for the sign-up dropdown)
--       - its OWN profile row
--   * Everything else (queue, matches, reports, blocks, admin data) is only
--     reachable from Next.js API routes using the service-role key, which
--     never leaves the server.
--   * Matching runs inside Postgres functions that take a transaction-level
--     advisory lock, so two people can never grab the same partner and a
--     user can never be in two active matches (also enforced by a unique
--     index as a second line of defence).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Universities and the admin-controlled list of approved email domains
-- ---------------------------------------------------------------------
create table if not exists public.universities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  short_name  text,
  state       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.approved_domains (
  domain            text primary key
                    check (domain = lower(domain) and domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'),
  university_id     uuid not null references public.universities(id) on delete cascade,
  -- true  → student@cs.example.edu is accepted for example.edu
  -- false → only the exact domain is accepted
  allow_subdomains  boolean not null default true,
  active            boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now()
);
create index if not exists approved_domains_university_idx on public.approved_domains(university_id);

-- Emails listed here may register without a college domain and become admins.
-- Add the founder's email BEFORE signing up (see seed.sql).
create table if not exists public.admin_emails (
  email text primary key check (email = lower(email))
);

-- ---------------------------------------------------------------------
-- Profiles (one per auth user). Email is NOT copied here, so it can never
-- leak through profile queries.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  university_id    uuid references public.universities(id),
  date_of_birth    date not null,
  role             text not null default 'student' check (role in ('student', 'admin')),
  status           text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  suspended_until  timestamptz,
  status_reason    text,
  email_domain     text,
  created_at       timestamptz not null default now()
  -- Future monetization (coins, gifts, decorations) should live in separate
  -- tables keyed by profiles.id, so this table stays small and simple.
);
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- ---------------------------------------------------------------------
-- Matching
-- ---------------------------------------------------------------------
create table if not exists public.match_queue (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  room_name   text not null unique,
  status      text not null default 'active' check (status in ('active', 'ended')),
  created_at  timestamptz not null default now(),
  ended_at    timestamptz,
  ended_by    uuid references public.profiles(id) on delete set null,
  end_reason  text
);
create index if not exists matches_status_idx on public.matches(status);

create table if not exists public.match_participants (
  match_id   uuid not null references public.matches(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  active     boolean not null default true,
  last_seen  timestamptz not null default now(),
  primary key (match_id, user_id)
);
-- A user can be in at most ONE active match. Enforced by the database itself.
create unique index if not exists match_participants_one_active_idx
  on public.match_participants(user_id) where active;

-- ---------------------------------------------------------------------
-- Safety
-- ---------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  reported_id  uuid not null references public.profiles(id) on delete cascade,
  match_id     uuid references public.matches(id) on delete set null,
  reason       text not null check (reason in
                 ('nudity_sexual', 'harassment', 'hate_speech', 'underage', 'not_a_student',
                  'violence_threats', 'spam_scam', 'other')),
  details      text check (char_length(details) <= 1000),
  status       text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  admin_notes  text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  check (reporter_id <> reported_id)
);
create index if not exists reports_reported_idx on public.reports(reported_id, created_at desc);
create index if not exists reports_status_idx on public.reports(status, created_at desc);
-- One report per reporter per match (stops report spamming).
create unique index if not exists reports_one_per_match_idx
  on public.reports(reporter_id, match_id) where match_id is not null;

-- Audit trail of every moderation action (manual or automatic).
create table if not exists public.moderation_actions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  admin_id    uuid references public.profiles(id) on delete set null, -- null = automatic
  action      text not null check (action in ('suspend', 'ban', 'reinstate', 'auto_suspend')),
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists moderation_actions_user_idx on public.moderation_actions(user_id, created_at desc);

-- Fixed-window rate limiter storage.
create table if not exists public.rate_limits (
  key           text primary key,
  window_start  timestamptz not null default now(),
  count         integer not null default 0
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.universities       enable row level security;
alter table public.approved_domains   enable row level security;
alter table public.admin_emails       enable row level security;
alter table public.profiles           enable row level security;
alter table public.match_queue        enable row level security;
alter table public.matches            enable row level security;
alter table public.match_participants enable row level security;
alter table public.blocks             enable row level security;
alter table public.reports            enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.rate_limits        enable row level security;

drop policy if exists "Anyone can read active universities" on public.universities;
create policy "Anyone can read active universities"
  on public.universities for select
  to anon, authenticated
  using (active);

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- No insert/update/delete policies anywhere: the browser cannot write.
-- All other tables have no policies at all → only the service role
-- (used exclusively by server code) can touch them.

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- Does an email domain belong to an approved, active domain of this university?
create or replace function public.cr_domain_allowed(p_domain text, p_university uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.approved_domains d
    join public.universities u on u.id = d.university_id
    where d.active and u.active
      and d.university_id = p_university
      and (lower(p_domain) = d.domain
           or (d.allow_subdomains and lower(p_domain) like '%.' || d.domain))
  );
$$;

-- Runs whenever Supabase Auth creates a user. Rejecting here means the
-- sign-up fails, even if someone bypasses our website and calls the
-- Supabase API directly with the public anon key.
create or replace function public.cr_handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_email    text  := lower(new.email);
  v_domain   text  := split_part(lower(new.email), '@', 2);
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text  := v_meta->>'username';
  v_univ     uuid;
  v_dob      date;
  v_is_admin boolean;
begin
  begin
    v_dob := (v_meta->>'date_of_birth')::date;
  exception when others then
    raise exception 'CR_INVALID_DOB';
  end;
  if v_dob is null or v_dob > (current_date - interval '18 years')::date then
    raise exception 'CR_UNDER_18';
  end if;
  if v_dob < date '1900-01-01' then
    raise exception 'CR_INVALID_DOB';
  end if;

  if v_username is null or v_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'CR_INVALID_USERNAME';
  end if;

  select exists (select 1 from public.admin_emails a where a.email = v_email) into v_is_admin;

  begin
    v_univ := nullif(v_meta->>'university_id', '')::uuid;
  exception when others then
    v_univ := null;
  end;

  if not v_is_admin then
    if v_univ is null or not public.cr_domain_allowed(v_domain, v_univ) then
      raise exception 'CR_DOMAIN_NOT_APPROVED';
    end if;
  end if;

  insert into public.profiles (id, username, university_id, date_of_birth, role, email_domain)
  values (new.id, v_username, v_univ, v_dob,
          case when v_is_admin then 'admin' else 'student' end, v_domain);
  return new;
end;
$$;

drop trigger if exists cr_on_auth_user_created on auth.users;
create trigger cr_on_auth_user_created
  after insert on auth.users
  for each row execute function public.cr_handle_new_user();

-- Stop verified students from switching their account email to a
-- non-college address (e.g. Gmail) after sign-up.
create or replace function public.cr_guard_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_domain text := split_part(lower(new.email), '@', 2);
  v_profile public.profiles%rowtype;
begin
  if new.email is not distinct from old.email then
    return new;
  end if;
  select * into v_profile from public.profiles p where p.id = new.id;
  if not found then
    return new;
  end if;
  if v_profile.role <> 'admin'
     and not public.cr_domain_allowed(v_domain, v_profile.university_id) then
    raise exception 'CR_DOMAIN_NOT_APPROVED';
  end if;
  update public.profiles set email_domain = v_domain where id = new.id;
  return new;
end;
$$;

drop trigger if exists cr_on_auth_user_email_change on auth.users;
create trigger cr_on_auth_user_email_change
  before update of email on auth.users
  for each row execute function public.cr_guard_email_change();

-- Case-insensitive username availability check (used by the sign-up API).
create or replace function public.cr_username_available(p_username text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (select 1 from public.profiles p where lower(p.username) = lower(p_username));
$$;

-- Is this user allowed to video chat right now?
-- (profile exists, email confirmed, not banned, not currently suspended)
create or replace function public.cr_can_chat(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = p_user
      and u.email_confirmed_at is not null
      and (p.status = 'active'
           or (p.status = 'suspended' and p.suspended_until is not null and p.suspended_until <= now()))
  );
$$;

-- Fixed-window rate limit. Returns true if the action is allowed.
create or replace function public.cr_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                     then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                            then now() else r.window_start end
  returning count into v_count;
  return v_count <= p_max;
end;
$$;

-- ---------------------------------------------------------------------
-- Matchmaking (atomic)
-- ---------------------------------------------------------------------
-- cr_matchmake(user, enqueue)
--   enqueue = true  → "Start Chat / Next": put me in the queue and try to match
--   enqueue = false → polling heartbeat: only act if I'm already queued/matched
-- Returns JSON: {status: 'matched', match_id} | {status: 'waiting'}
--             | {status: 'idle'} | {status: 'forbidden'}
create or replace function public.cr_matchmake(p_user uuid, p_enqueue boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_match_id uuid;
  v_partner  uuid;
begin
  -- One matchmaker at a time. Held until this transaction ends.
  -- At MVP scale (hundreds of users) this is fast and removes every race.
  perform pg_advisory_xact_lock(4242001);

  -- Housekeeping: drop people who closed the tab without leaving.
  delete from public.match_queue where last_seen < now() - interval '25 seconds';

  with stale as (
    update public.matches m
       set status = 'ended', ended_at = now(), end_reason = 'timeout'
     where m.status = 'active'
       and exists (select 1 from public.match_participants mp
                    where mp.match_id = m.id and mp.active
                      and mp.last_seen < now() - interval '45 seconds')
    returning m.id
  )
  update public.match_participants mp
     set active = false
   where mp.match_id in (select s.id from stale s);

  -- Banned / suspended / unverified → kick out of queue and any match.
  if not public.cr_can_chat(p_user) then
    delete from public.match_queue where user_id = p_user;
    with ended as (
      update public.matches m
         set status = 'ended', ended_at = now(), ended_by = p_user, end_reason = 'account_restricted'
       where m.status = 'active'
         and m.id in (select mp.match_id from public.match_participants mp
                       where mp.user_id = p_user and mp.active)
      returning m.id
    )
    update public.match_participants mp set active = false
     where mp.match_id in (select e.id from ended e);
    return jsonb_build_object('status', 'forbidden');
  end if;

  -- Already in a match? Heartbeat and report it.
  select mp.match_id into v_match_id
    from public.match_participants mp
   where mp.user_id = p_user and mp.active;
  if v_match_id is not null then
    update public.match_participants
       set last_seen = now()
     where match_id = v_match_id and user_id = p_user;
    delete from public.match_queue where user_id = p_user;
    return jsonb_build_object('status', 'matched', 'match_id', v_match_id);
  end if;

  if p_enqueue then
    insert into public.match_queue (user_id) values (p_user)
    on conflict (user_id) do update set last_seen = now();
  else
    update public.match_queue set last_seen = now() where user_id = p_user;
    if not found then
      return jsonb_build_object('status', 'idle');
    end if;
  end if;

  -- Pick the longest-waiting eligible partner, preferring people we did
  -- NOT just talk to in the last 3 minutes (so "Next" finds someone new).
  select q.user_id into v_partner
    from public.match_queue q
   where q.user_id <> p_user
     and q.last_seen >= now() - interval '25 seconds'
     and public.cr_can_chat(q.user_id)
     and not exists (select 1 from public.blocks b
                      where (b.blocker_id = p_user and b.blocked_id = q.user_id)
                         or (b.blocker_id = q.user_id and b.blocked_id = p_user))
     and not exists (select 1 from public.match_participants a
                      where a.user_id = q.user_id and a.active)
   order by
     (exists (select 1
                from public.match_participants x
                join public.match_participants y on y.match_id = x.match_id
                join public.matches mm on mm.id = x.match_id
               where x.user_id = p_user and y.user_id = q.user_id
                 and mm.created_at > now() - interval '3 minutes')) asc,
     q.joined_at asc
   limit 1;

  if v_partner is null then
    return jsonb_build_object('status', 'waiting');
  end if;

  v_match_id := gen_random_uuid();
  insert into public.matches (id, room_name)
  values (v_match_id, 'cr-' || replace(v_match_id::text, '-', ''));
  insert into public.match_participants (match_id, user_id)
  values (v_match_id, p_user), (v_match_id, v_partner);
  delete from public.match_queue where user_id in (p_user, v_partner);

  return jsonb_build_object('status', 'matched', 'match_id', v_match_id);
end;
$$;

-- End every active match this user is in. Returns the Daily room names so
-- the server can delete the rooms (which instantly disconnects BOTH people).
create or replace function public.cr_end_match(p_user uuid, p_reason text)
returns setof text
language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(4242001);
  delete from public.match_queue where user_id = p_user;
  return query
    with ended as (
      update public.matches m
         set status = 'ended', ended_at = now(), ended_by = p_user, end_reason = p_reason
       where m.status = 'active'
         and m.id in (select mp.match_id from public.match_participants mp
                       where mp.user_id = p_user and mp.active)
      returning m.id, m.room_name
    ),
    parts as (
      update public.match_participants mp
         set active = false
       where mp.match_id in (select e.id from ended e)
      returning 1
    )
    select e.room_name from ended e;
end;
$$;

-- Leave the waiting queue (doesn't touch matches).
create or replace function public.cr_leave_queue(p_user uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.match_queue where user_id = p_user;
$$;

-- Partner details for a match, safe to show: username + university only.
create or replace function public.cr_match_info(p_user uuid, p_match uuid)
returns table (match_id uuid, room_name text, match_status text, created_at timestamptz,
               partner_id uuid, partner_username text, partner_university text)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.room_name, m.status, m.created_at,
         other.user_id, pr.username, coalesce(u.name, 'CollegeRandom Team')
    from public.matches m
    join public.match_participants me    on me.match_id = m.id and me.user_id = p_user
    join public.match_participants other on other.match_id = m.id and other.user_id <> p_user
    join public.profiles pr on pr.id = other.user_id
    left join public.universities u on u.id = pr.university_id
   where m.id = p_match;
$$;

-- ---------------------------------------------------------------------
-- Automatic abuse detection: 3+ different people reporting the same user
-- within 24 hours → auto-suspend for 24 hours pending admin review.
-- ---------------------------------------------------------------------
create or replace function public.cr_after_report()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_reporters integer;
begin
  select count(distinct r.reporter_id) into v_reporters
    from public.reports r
   where r.reported_id = new.reported_id
     and r.created_at > now() - interval '24 hours';

  if v_reporters >= 3 then
    update public.profiles
       set status = 'suspended',
           suspended_until = now() + interval '24 hours',
           status_reason = 'Automatically suspended after multiple reports (pending review)'
     where id = new.reported_id and status = 'active' and role <> 'admin';
    if found then
      insert into public.moderation_actions (user_id, admin_id, action, reason)
      values (new.reported_id, null, 'auto_suspend', v_reporters || ' reports in 24h');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cr_on_report_created on public.reports;
create trigger cr_on_report_created
  after insert on public.reports
  for each row execute function public.cr_after_report();

-- ---------------------------------------------------------------------
-- Admin helpers (service role only). These join auth.users so admins can
-- see emails; students never can.
-- ---------------------------------------------------------------------
create or replace function public.cr_admin_users(p_search text, p_limit integer default 50)
returns table (id uuid, username text, email text, university text, role text, status text,
               suspended_until timestamptz, status_reason text, email_confirmed boolean,
               created_at timestamptz, report_count bigint, open_report_count bigint)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username, u.email::text, un.name, p.role, p.status,
         p.suspended_until, p.status_reason, (u.email_confirmed_at is not null),
         p.created_at,
         (select count(*) from public.reports r where r.reported_id = p.id),
         (select count(*) from public.reports r where r.reported_id = p.id and r.status = 'open')
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.universities un on un.id = p.university_id
   where coalesce(p_search, '') = ''
      or p.username ilike '%' || p_search || '%'
      or u.email ilike '%' || p_search || '%'
      or p.id::text = p_search
   order by p.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

create or replace function public.cr_admin_reports(p_status text, p_user uuid default null)
returns table (id uuid, created_at timestamptz, reason text, details text, status text,
               admin_notes text, match_id uuid,
               reporter_id uuid, reporter_username text,
               reported_id uuid, reported_username text, reported_email text,
               reported_status text, reported_total_reports bigint)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.created_at, r.reason, r.details, r.status, r.admin_notes, r.match_id,
         r.reporter_id, rp.username,
         r.reported_id, dp.username, du.email::text, dp.status,
         (select count(*) from public.reports x where x.reported_id = r.reported_id)
    from public.reports r
    join public.profiles rp on rp.id = r.reporter_id
    join public.profiles dp on dp.id = r.reported_id
    join auth.users du on du.id = r.reported_id
   where (coalesce(p_status, 'all') = 'all' or r.status = p_status)
     and (p_user is null or r.reported_id = p_user or r.reporter_id = p_user)
   order by r.created_at desc
   limit 200;
$$;

create or replace function public.cr_admin_stats()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'users',           (select count(*) from public.profiles),
    'verified_users',  (select count(*) from public.profiles p join auth.users u on u.id = p.id
                         where u.email_confirmed_at is not null),
    'waiting_now',     (select count(*) from public.match_queue where last_seen > now() - interval '25 seconds'),
    'active_matches',  (select count(*) from public.matches where status = 'active'),
    'matches_24h',     (select count(*) from public.matches where created_at > now() - interval '24 hours'),
    'open_reports',    (select count(*) from public.reports where status = 'open'),
    'suspended_users', (select count(*) from public.profiles where status = 'suspended'
                         and (suspended_until is null or suspended_until > now())),
    'banned_users',    (select count(*) from public.profiles where status = 'banned')
  );
$$;

-- ---------------------------------------------------------------------
-- Lock down functions: callable ONLY by the service role (server code).
-- Without this, Supabase would expose them to anyone with the anon key.
-- ---------------------------------------------------------------------
revoke all on function public.cr_domain_allowed(text, uuid)           from public, anon, authenticated;
revoke all on function public.cr_can_chat(uuid)                        from public, anon, authenticated;
revoke all on function public.cr_username_available(text)              from public, anon, authenticated;
revoke all on function public.cr_rate_limit(text, integer, integer)    from public, anon, authenticated;
revoke all on function public.cr_matchmake(uuid, boolean)              from public, anon, authenticated;
revoke all on function public.cr_end_match(uuid, text)                 from public, anon, authenticated;
revoke all on function public.cr_leave_queue(uuid)                     from public, anon, authenticated;
revoke all on function public.cr_match_info(uuid, uuid)                from public, anon, authenticated;
revoke all on function public.cr_admin_users(text, integer)            from public, anon, authenticated;
revoke all on function public.cr_admin_reports(text, uuid)             from public, anon, authenticated;
revoke all on function public.cr_admin_stats()                         from public, anon, authenticated;
revoke all on function public.cr_handle_new_user()                     from public, anon, authenticated;
revoke all on function public.cr_guard_email_change()                  from public, anon, authenticated;
revoke all on function public.cr_after_report()                        from public, anon, authenticated;

grant execute on function public.cr_domain_allowed(text, uuid)        to service_role;
grant execute on function public.cr_can_chat(uuid)                     to service_role;
grant execute on function public.cr_username_available(text)           to service_role;
grant execute on function public.cr_rate_limit(text, integer, integer) to service_role;
grant execute on function public.cr_matchmake(uuid, boolean)           to service_role;
grant execute on function public.cr_end_match(uuid, text)              to service_role;
grant execute on function public.cr_leave_queue(uuid)                  to service_role;
grant execute on function public.cr_match_info(uuid, uuid)             to service_role;
grant execute on function public.cr_admin_users(text, integer)         to service_role;
grant execute on function public.cr_admin_reports(text, uuid)          to service_role;
grant execute on function public.cr_admin_stats()                      to service_role;
