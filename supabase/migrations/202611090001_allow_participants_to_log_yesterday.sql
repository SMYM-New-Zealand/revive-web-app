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
    if new.competition_day < today_in_competition_timezone - 1
        or new.competition_day > today_in_competition_timezone then
      raise exception 'Completions can only be recorded for today or yesterday'
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
