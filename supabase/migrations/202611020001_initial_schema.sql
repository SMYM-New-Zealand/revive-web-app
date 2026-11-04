create extension if not exists pgcrypto;

create table public.allowed_emails (
  email text primary key,
  is_admin boolean not null default false
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  tier text not null check (tier in ('novice', 'challenger', 'elite', 'bonus')),
  title text not null,
  points int not null check (points > 0),
  starts_on date,
  ends_on date,
  sort_order int not null default 0,
  active boolean not null default true,
  unique (tier, title),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

create table public.competition_config (
  id int primary key default 1 check (id = 1),
  name text not null default 'Revive',
  starts_on date not null,
  ends_on date not null,
  timezone text not null default 'Pacific/Auckland',
  check (starts_on <= ends_on)
);

create table public.completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id),
  competition_day date not null,
  points_awarded int not null,
  completed_at timestamptz not null default now(),
  unique (user_id, challenge_id, competition_day)
);

create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_emails
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_emails
    where lower(email) = lower(auth.jwt() ->> 'email')
      and is_admin
  );
$$;

create or replace function public.sync_allowed_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(new.email);
  participant_name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    new.email
  );
begin
  if exists (
    select 1 from public.allowed_emails
    where lower(email) = normalized_email
  ) then
    insert into public.profiles (id, email, display_name)
    values (new.id, normalized_email, participant_name)
    on conflict (id) do update
      set email = excluded.email, display_name = excluded.display_name;
  else
    delete from public.profiles where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_allowed_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_allowed_profile();

create or replace function public.sync_my_profile()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user auth.users%rowtype;
begin
  select * into auth_user from auth.users where id = auth.uid();
  if not found or auth_user.email is null then
    return false;
  end if;

  if not exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(auth_user.email)
  ) then
    delete from public.profiles where id = auth_user.id;
    return false;
  end if;

  insert into public.profiles (id, email, display_name)
  values (
    auth_user.id,
    lower(auth_user.email),
    coalesce(
      nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
      nullif(auth_user.raw_user_meta_data ->> 'name', ''),
      auth_user.email
    )
  )
  on conflict (id) do update
    set email = excluded.email, display_name = excluded.display_name;
  return true;
end;
$$;

create or replace function public.enforce_completion_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  config public.competition_config%rowtype;
  selected_challenge public.challenges%rowtype;
  today_in_competition_timezone date;
begin
  select * into config from public.competition_config where id = 1;
  if not found then
    raise exception 'Competition settings have not been configured'
      using errcode = '23514';
  end if;

  today_in_competition_timezone :=
    (now() at time zone config.timezone)::date;

  if new.competition_day <> today_in_competition_timezone then
    raise exception 'Completions can only be recorded for today'
      using errcode = '23514';
  end if;

  if new.competition_day < config.starts_on or new.competition_day > config.ends_on then
    raise exception 'Today is outside the competition dates'
      using errcode = '23514';
  end if;

  select * into selected_challenge
  from public.challenges
  where id = new.challenge_id;
  if not found or not selected_challenge.active then
    raise exception 'This challenge is not active'
      using errcode = '23514';
  end if;
  if selected_challenge.starts_on is not null
      and new.competition_day < selected_challenge.starts_on then
    raise exception 'This challenge is not available yet'
      using errcode = '23514';
  end if;
  if selected_challenge.ends_on is not null
      and new.competition_day > selected_challenge.ends_on then
    raise exception 'This challenge is no longer available'
      using errcode = '23514';
  end if;

  new.points_awarded := selected_challenge.points;
  return new;
end;
$$;

create trigger enforce_completion_rules
before insert on public.completions
for each row execute function public.enforce_completion_rules();

create view public.daily_points
with (security_invoker = true)
as
select user_id, competition_day, sum(points_awarded)::bigint as points
from public.completions
group by user_id, competition_day;

create view public.leaderboard
with (security_barrier = true)
as
select
  rank() over (order by coalesce(sum(c.points_awarded), 0) desc) as rank,
  p.id as user_id,
  p.display_name,
  coalesce(sum(c.points_awarded), 0)::bigint as total_points
from public.profiles p
left join public.completions c on c.user_id = p.id
where public.is_allowed_user()
group by p.id, p.display_name;

create or replace function public.leaderboard_for_day(p_competition_day date)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  today_points bigint,
  total_points bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with scores as (
    select
      p.id,
      p.display_name,
      coalesce(sum(c.points_awarded) filter (
        where c.competition_day = p_competition_day
      ), 0)::bigint as day_points,
      coalesce(sum(c.points_awarded), 0)::bigint as all_points
    from public.profiles p
    left join public.completions c on c.user_id = p.id
    where public.is_allowed_user()
    group by p.id, p.display_name
  )
  select
    rank() over (order by all_points desc),
    id,
    display_name,
    day_points,
    all_points
  from scores;
$$;

alter table public.allowed_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.competition_config enable row level security;
alter table public.completions enable row level security;

create policy "Participants can read their own allowlist entry"
on public.allowed_emails for select to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email') or public.is_admin());

create policy "Admins can add allowlist entries"
on public.allowed_emails for insert to authenticated
with check (public.is_admin());

create policy "Admins can update allowlist entries"
on public.allowed_emails for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Allowed participants can read profiles"
on public.profiles for select to authenticated
using (public.is_allowed_user());

create policy "Allowed participants can read challenges"
on public.challenges for select to authenticated
using (public.is_allowed_user());

create policy "Admins can add challenges"
on public.challenges for insert to authenticated
with check (public.is_admin());

create policy "Admins can update challenges"
on public.challenges for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Allowed participants can read competition settings"
on public.competition_config for select to authenticated
using (public.is_allowed_user());

create policy "Admins can update competition settings"
on public.competition_config for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Participants can read their own completions"
on public.completions for select to authenticated
using (user_id = auth.uid() and public.is_allowed_user());

create policy "Participants can submit their own completions"
on public.completions for insert to authenticated
with check (user_id = auth.uid() and public.is_allowed_user());

grant usage on schema public to authenticated;
grant select on public.allowed_emails, public.profiles, public.challenges,
  public.competition_config, public.completions, public.daily_points,
  public.leaderboard to authenticated;
grant insert, update on public.allowed_emails to authenticated;
grant insert, update on public.challenges to authenticated;
grant update on public.competition_config to authenticated;
grant insert on public.completions to authenticated;
revoke update, delete on public.completions from authenticated;
revoke all on function public.sync_allowed_profile() from public, anon, authenticated;
revoke all on function public.sync_my_profile() from public, anon;
revoke all on function public.enforce_completion_rules() from public, anon, authenticated;
grant execute on function public.is_allowed_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.sync_my_profile() to authenticated;
grant execute on function public.leaderboard_for_day(date) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'completions'
  ) then
    alter publication supabase_realtime add table public.completions;
  end if;
end;
$$;

create or replace function public.broadcast_leaderboard_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('competition_day', new.competition_day),
    'completion_changed',
    'leaderboard',
    false
  );
  return new;
end;
$$;

create trigger broadcast_completion_for_leaderboard
after insert on public.completions
for each row execute function public.broadcast_leaderboard_completion();

revoke all on function public.broadcast_leaderboard_completion() from public, anon, authenticated;
