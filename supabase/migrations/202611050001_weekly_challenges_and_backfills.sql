alter table public.challenges
  add column once_per_week boolean not null default false;

alter table public.completions
  add column competition_week_start date,
  add column is_weekly_completion boolean not null default false;

update public.completions c
set
  competition_week_start = case
    when config.starts_on is null then c.competition_day
    else config.starts_on
      + floor((c.competition_day - config.starts_on) / 7.0)::int * 7
  end,
  is_weekly_completion = challenge.once_per_week
from public.challenges challenge
left join public.competition_config config on config.id = 1
where c.challenge_id = challenge.id;

update public.completions
set competition_week_start = competition_day
where competition_week_start is null;

alter table public.completions
  alter column competition_week_start set not null;

create unique index completions_user_challenge_weekly_key
on public.completions (user_id, challenge_id, competition_week_start)
where is_weekly_completion;

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
    ((now() at time zone config.timezone) - interval '4 hours')::date;

  if new.competition_day < config.starts_on or new.competition_day > config.ends_on then
    raise exception 'Competition day is outside the competition dates'
      using errcode = '23514';
  end if;

  if current_setting('revive.admin_backfill', true) = 'true' then
    if not public.is_admin() or new.competition_day >= today_in_competition_timezone then
      raise exception 'Only admins can backfill a past competition day'
        using errcode = '42501';
    end if;
  elsif new.user_id = auth.uid() then
    if new.competition_day <> today_in_competition_timezone then
      raise exception 'Completions can only be recorded for the current competition day'
        using errcode = '23514';
    end if;
  elsif not public.is_admin() or new.competition_day >= today_in_competition_timezone then
    raise exception 'Only admins can backfill a past competition day'
      using errcode = '42501';
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

  new.competition_week_start := config.starts_on
    + floor((new.competition_day - config.starts_on) / 7.0)::int * 7;
  new.is_weekly_completion := selected_challenge.once_per_week;

  if selected_challenge.once_per_week then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        new.user_id::text || ':' || new.challenge_id::text || ':'
          || new.competition_week_start::text,
        0
      )
    );

    if exists (
      select 1
      from public.completions existing
      where existing.user_id = new.user_id
        and existing.challenge_id = new.challenge_id
        and existing.competition_day >= new.competition_week_start
        and existing.competition_day < new.competition_week_start + 7
    ) then
      raise exception 'This weekly challenge has already been completed this competition week'
        using
          errcode = '23505',
          constraint = 'completions_user_challenge_weekly_key';
    end if;
  end if;

  new.points_awarded := selected_challenge.points;
  return new;
end;
$$;

create or replace function public.admin_backfill_completions(
  p_user_id uuid,
  p_competition_day date,
  p_challenge_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  config public.competition_config%rowtype;
  today_in_competition_timezone date;
  unique_challenge_count integer;
  available_challenge_count integer;
  inserted_count integer := 0;
  challenge_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only admins can backfill completions'
      using errcode = '42501';
  end if;

  if p_user_id is null or p_competition_day is null
      or p_challenge_ids is null or cardinality(p_challenge_ids) = 0 then
    raise exception 'Choose a participant, past competition day, and at least one challenge'
      using errcode = '22023';
  end if;

  select * into config from public.competition_config where id = 1;
  if not found then
    raise exception 'Competition settings have not been configured'
      using errcode = '23514';
  end if;

  today_in_competition_timezone :=
    ((now() at time zone config.timezone) - interval '4 hours')::date;

  if p_competition_day < config.starts_on
      or p_competition_day > config.ends_on
      or p_competition_day >= today_in_competition_timezone then
    raise exception 'Choose a past competition day within the competition dates'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    join public.allowed_emails allowed
      on lower(allowed.email) = lower(profile.email)
    where profile.id = p_user_id
  ) then
    raise exception 'The selected participant is not on the allowlist'
      using errcode = '23514';
  end if;

  select count(distinct selected.id)::int
  into unique_challenge_count
  from unnest(p_challenge_ids) as selected(id);
  if unique_challenge_count <> cardinality(p_challenge_ids) then
    raise exception 'A challenge may only be selected once per backfill'
      using errcode = '22023';
  end if;

  select count(*)::int
  into available_challenge_count
  from public.challenges challenge
  where challenge.id = any(p_challenge_ids)
    and challenge.active
    and (challenge.starts_on is null or p_competition_day >= challenge.starts_on)
    and (challenge.ends_on is null or p_competition_day <= challenge.ends_on);

  if available_challenge_count <> unique_challenge_count then
    raise exception 'One or more selected challenges were not available on that date'
      using errcode = '23514';
  end if;

  perform pg_catalog.set_config('revive.admin_backfill', 'true', true);

  for challenge_id in
    select selected.id
    from unnest(p_challenge_ids) as selected(id)
    order by selected.id
  loop
    insert into public.completions (
      user_id,
      challenge_id,
      competition_day,
      points_awarded
    )
    select p_user_id, challenge.id, p_competition_day, challenge.points
    from public.challenges challenge
    where challenge.id = challenge_id;

    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.admin_backfill_completions(uuid, date, uuid[])
  from public, anon;
grant execute on function public.admin_backfill_completions(uuid, date, uuid[])
  to authenticated;
