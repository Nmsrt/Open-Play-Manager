-- Players no longer pick a team color; instead they can ask to play with
-- specific people. The admin reads these requests while building teams.

alter table public.players
  add column teammate_requests text check (char_length(teammate_requests) <= 300);

-- Recreate the registration RPC: drop p_preferred_team / p_phone /
-- p_reference_number (no longer collected), add p_teammate_requests.
drop function if exists public.register_player(
  uuid, text, text, text, player_position, text, text, uuid, numeric, payment_method, text, text
);

create function public.register_player(
  p_session_id uuid,
  p_full_name text,
  p_email text,
  p_preferred_position player_position default 'ANY',
  p_skill_level text default null,
  p_notes text default null,
  p_teammate_requests text default null,
  p_amount numeric default null,
  p_method payment_method default 'cash',
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

  insert into public.players (session_id, full_name, email, preferred_position,
                              skill_level, notes, teammate_requests)
  values (p_session_id, trim(p_full_name), lower(trim(p_email)), p_preferred_position,
          p_skill_level, nullif(trim(coalesce(p_notes, '')), ''),
          nullif(trim(coalesce(p_teammate_requests, '')), ''))
  returning * into new_player;

  insert into public.payments (player_id, amount, method, proof_image_path)
  values (new_player.id, coalesce(p_amount, s.fee_amount), p_method, p_proof_image_path);

  return jsonb_build_object('player_id', new_player.id, 'status', new_player.status);
end;
$$;

revoke all on function public.register_player(uuid, text, text, player_position, text, text, text, numeric, payment_method, text) from public;
grant execute on function public.register_player(uuid, text, text, player_position, text, text, text, numeric, payment_method, text) to anon, authenticated;
