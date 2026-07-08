-- OpenPlay initial schema.
-- This app is a static SPA: RLS in this file IS the security boundary.
-- Only the anon key ships to the browser; the service role key is never used by app code.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type session_format as enum ('5-a-side', '7-a-side', '11-a-side', 'custom');
create type session_status as enum ('draft', 'open', 'closed', 'completed');
create type player_position as enum ('GK', 'DEF', 'MID', 'FWD', 'ANY');
create type player_status as enum ('registered', 'waitlisted', 'cancelled');
create type payment_method as enum ('gcash', 'maya', 'bank', 'cash', 'other');
create type payment_status as enum ('pending', 'verified', 'rejected');
create type assignment_source as enum ('admin', 'self');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 2000),
  date timestamptz not null,
  location text not null check (char_length(location) between 2 and 200),
  format session_format not null default '7-a-side',
  players_per_team integer not null check (players_per_team between 1 and 30),
  team_count integer not null default 2 check (team_count between 2 and 12),
  max_players integer generated always as (players_per_team * team_count) stored,
  fee_amount numeric(10, 2) not null default 0 check (fee_amount >= 0),
  status session_status not null default 'draft',
  teams_published boolean not null default false,
  registered_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color_tag text not null default '' check (char_length(color_tag) <= 30),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (session_id, name)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  email text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(email) <= 254),
  phone text not null check (phone ~ '^[0-9+() -]{7,20}$'),
  preferred_team uuid references public.teams (id) on delete set null,
  preferred_position player_position not null default 'ANY',
  skill_level text check (skill_level in ('beginner', 'intermediate', 'advanced')),
  notes text check (char_length(notes) <= 500),
  status player_status not null default 'registered',
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

-- Duplicate-registration guard, enforced by the database, not the client.
create unique index players_session_email_key on public.players (session_id, lower(email))
  where status <> 'cancelled';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  method payment_method not null,
  reference_number text check (char_length(reference_number) <= 100),
  proof_image_path text check (char_length(proof_image_path) <= 300),
  status payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.team_assignments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  jersey_number integer check (jersey_number between 1 and 99),
  assigned_by assignment_source not null default 'admin',
  updated_at timestamptz not null default now(),
  unique (player_id)
);

-- Which auth users are admins. Populated manually (see README); sign-ups are
-- disabled in the Supabase dashboard, so no self-service path exists.
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.log_audit(p_action text, p_entity text, p_entity_id uuid, p_details jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (actor, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_details);
$$;

revoke all on function public.log_audit(text, text, uuid, jsonb) from public;
grant execute on function public.log_audit(text, text, uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: capacity / waitlist / counters
-- ---------------------------------------------------------------------------

-- On registration: lock the session row, reject non-open sessions, and put
-- the player on the waitlist when the session is at capacity. Also neutralise
-- fields the public must never set.
create or replace function public.handle_player_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sessions%rowtype;
begin
  select * into s from public.sessions where id = new.session_id for update;
  if not found then
    raise exception 'Session not found';
  end if;

  if not public.is_admin() then
    if s.status <> 'open' then
      raise exception 'Session is not open for registration';
    end if;
    new.checked_in_at := null;
    new.status := 'registered';
  end if;

  if new.status = 'registered' and s.registered_count >= s.max_players then
    new.status := 'waitlisted';
  end if;

  return new;
end;
$$;

create trigger players_before_insert
  before insert on public.players
  for each row execute function public.handle_player_insert();

-- Keep sessions.registered_count accurate. Public page subscribes to
-- realtime UPDATEs on sessions to show a live slot counter without exposing
-- player rows (PII) to anon.
create or replace function public.refresh_registered_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  sid := coalesce(new.session_id, old.session_id);
  update public.sessions
     set registered_count = (
       select count(*) from public.players
       where session_id = sid and status = 'registered'
     )
   where id = sid;
  return null;
end;
$$;

create trigger players_after_change
  after insert or update of status or delete on public.players
  for each row execute function public.refresh_registered_count();

-- Auto-promote the oldest waitlisted player when a spot opens.
create or replace function public.promote_from_waitlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sessions%rowtype;
  next_id uuid;
begin
  if pg_trigger_depth() > 2 then
    return null;
  end if;

  select * into s from public.sessions where id = coalesce(new.session_id, old.session_id) for update;
  if not found or s.status not in ('open', 'closed') then
    return null;
  end if;

  while s.registered_count < s.max_players loop
    select id into next_id from public.players
     where session_id = s.id and status = 'waitlisted'
     order by created_at
     limit 1;
    exit when next_id is null;
    update public.players set status = 'registered' where id = next_id;
    select registered_count into s.registered_count from public.sessions where id = s.id;
  end loop;

  return null;
end;
$$;

create trigger players_promote_waitlist
  after update of status or delete on public.players
  for each row execute function public.promote_from_waitlist();

-- team_assignments.updated_at bookkeeping.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger team_assignments_touch
  before update on public.team_assignments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Triggers: audit log for admin actions
-- ---------------------------------------------------------------------------
create or replace function public.audit_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.log_audit(
      'payment_status_changed', 'payments', new.id,
      jsonb_build_object('from', old.status, 'to', new.status, 'player_id', new.player_id)
    );
  end if;
  return new;
end;
$$;

create trigger payments_audit
  after update on public.payments
  for each row execute function public.audit_payment_status();

create or replace function public.audit_team_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.log_audit('assignment_removed', 'team_assignments', old.id,
      jsonb_build_object('player_id', old.player_id, 'team_id', old.team_id));
    return old;
  end if;
  perform public.log_audit(
    case tg_op when 'INSERT' then 'assignment_created' else 'assignment_updated' end,
    'team_assignments', new.id,
    jsonb_build_object('player_id', new.player_id, 'team_id', new.team_id, 'assigned_by', new.assigned_by)
  );
  return new;
end;
$$;

create trigger team_assignments_audit
  after insert or update or delete on public.team_assignments
  for each row execute function public.audit_team_assignment();

-- ---------------------------------------------------------------------------
-- Registration RPC: atomic player + payment insert for the public form.
-- SECURITY DEFINER so the pair is written together; every input is validated
-- here and by the table constraints above.
-- ---------------------------------------------------------------------------
create or replace function public.register_player(
  p_session_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_preferred_position player_position default 'ANY',
  p_skill_level text default null,
  p_notes text default null,
  p_preferred_team uuid default null,
  p_amount numeric default null,
  p_method payment_method default 'cash',
  p_reference_number text default null,
  p_proof_image_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sessions%rowtype;
  new_player public.players%rowtype;
begin
  select * into s from public.sessions where id = p_session_id for update;
  if not found or s.status <> 'open' then
    raise exception 'REGISTRATION_CLOSED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.players
    where session_id = p_session_id and lower(email) = lower(p_email) and status <> 'cancelled'
  ) then
    raise exception 'ALREADY_REGISTERED' using errcode = 'P0001';
  end if;

  if p_preferred_team is not null and not exists (
    select 1 from public.teams where id = p_preferred_team and session_id = p_session_id
  ) then
    raise exception 'INVALID_TEAM' using errcode = 'P0001';
  end if;

  insert into public.players (session_id, full_name, email, phone, preferred_team,
                              preferred_position, skill_level, notes)
  values (p_session_id, trim(p_full_name), lower(trim(p_email)), trim(p_phone), p_preferred_team,
          p_preferred_position, p_skill_level, nullif(trim(coalesce(p_notes, '')), ''))
  returning * into new_player;

  insert into public.payments (player_id, amount, method, reference_number, proof_image_path)
  values (new_player.id, coalesce(p_amount, s.fee_amount), p_method,
          nullif(trim(coalesce(p_reference_number, '')), ''), p_proof_image_path);

  return jsonb_build_object('player_id', new_player.id, 'status', new_player.status);
end;
$$;

revoke all on function public.register_player(uuid, text, text, text, player_position, text, text, uuid, numeric, payment_method, text, text) from public;
grant execute on function public.register_player(uuid, text, text, text, player_position, text, text, uuid, numeric, payment_method, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public views (owner rights, deliberately narrow columns — no PII).
-- ---------------------------------------------------------------------------

-- Final rosters, visible only once the admin publishes teams.
create view public.public_rosters as
select t.session_id,
       t.id as team_id,
       t.name as team_name,
       t.color_tag,
       p.full_name,
       ta.jersey_number
from public.team_assignments ta
join public.teams t on t.id = ta.team_id
join public.players p on p.id = ta.player_id
join public.sessions s on s.id = t.session_id
where s.teams_published and s.status <> 'draft';

-- Live "how many players want each team" counts for the preference picker.
create view public.team_preference_counts as
select p.session_id,
       p.preferred_team as team_id,
       count(*) as preference_count
from public.players p
join public.sessions s on s.id = p.session_id
where p.preferred_team is not null
  and p.status <> 'cancelled'
  and s.status <> 'draft'
group by p.session_id, p.preferred_team;

grant select on public.public_rosters, public.team_preference_counts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security. Written as if the React app did not exist.
-- ---------------------------------------------------------------------------
alter table public.sessions enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.payments enable row level security;
alter table public.team_assignments enable row level security;
alter table public.admin_users enable row level security;
alter table public.audit_log enable row level security;

-- sessions: public can read anything the admin has made visible (not drafts).
create policy "public read non-draft sessions" on public.sessions
  for select to anon, authenticated
  using (status <> 'draft');

create policy "admin full access sessions" on public.sessions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- teams: read-only for the public (needed for the preference picker).
create policy "public read teams" on public.teams
  for select to anon, authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and s.status <> 'draft'));

create policy "admin full access teams" on public.teams
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- players: INSERT-only for the public, into open sessions. No SELECT (PII),
-- no UPDATE, no DELETE under any circumstance for anon.
create policy "public register player" on public.players
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.sessions s where s.id = session_id and s.status = 'open')
  );

create policy "admin full access players" on public.players
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- payments: INSERT-only for the public, pending only, tied to an open session.
create policy "public submit payment" on public.payments
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and exists (
      select 1 from public.players p
      join public.sessions s on s.id = p.session_id
      where p.id = player_id and s.status = 'open'
    )
  );

create policy "admin full access payments" on public.payments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- team_assignments: public may read only after the admin publishes teams.
create policy "public read published assignments" on public.team_assignments
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.teams t
      join public.sessions s on s.id = t.session_id
      where t.id = team_id and s.teams_published and s.status <> 'draft'
    )
  );

create policy "admin full access assignments" on public.team_assignments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- admin_users: an admin may see their own row. Nobody can write via the API;
-- rows are inserted manually with the service role / SQL editor (see README).
create policy "admin read self" on public.admin_users
  for select to authenticated
  using (user_id = auth.uid());

-- audit_log: admin read-only. Writes happen via the security definer
-- log_audit() function only.
create policy "admin read audit log" on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for proof-of-payment images.
-- Served to the admin via signed URLs only; never public.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "public upload payment proof" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'payment-proofs');

create policy "admin read payment proofs" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_admin());

create policy "admin delete payment proofs" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-proofs' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime: sessions (live slot counter), teams and assignments (published
-- rosters). RLS still applies to realtime payloads.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.team_assignments;
