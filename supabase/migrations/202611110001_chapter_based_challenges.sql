alter table public.challenges
  add column points_per_chapter integer
  check (points_per_chapter is null or points_per_chapter > 0);

alter table public.challenges
  add constraint challenges_chapter_points_are_daily
  check (points_per_chapter is null or not once_per_week);

alter table public.completions
  add column chapters_read integer
  check (chapters_read is null or chapters_read > 0);

create policy "Admins can read all completions"
on public.completions for select to authenticated
using (public.is_admin());

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
  calculated_points bigint;
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

  if selected_challenge.points_per_chapter is not null then
    if new.chapters_read is null or new.chapters_read <= 0 then
      raise exception 'Enter a positive number of chapters'
        using errcode = '23514';
    end if;

    calculated_points := new.chapters_read::bigint
      * selected_challenge.points_per_chapter;
    if calculated_points > 2147483647 then
      raise exception 'The calculated points exceed the supported limit'
        using errcode = '22003';
    end if;
    new.points_awarded := calculated_points::integer;
  else
    if new.chapters_read is not null then
      raise exception 'Chapter counts are only valid for per-chapter challenges'
        using errcode = '23514';
    end if;
    new.points_awarded := selected_challenge.points;
  end if;

  return new;
end;
$$;

create or replace function public.admin_update_chapter_completion(
  p_completion_id uuid,
  p_chapters_read integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge_rate integer;
  calculated_points bigint;
  updated_points integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only admins can correct completion entries'
      using errcode = '42501';
  end if;
  if p_completion_id is null or p_chapters_read is null or p_chapters_read <= 0 then
    raise exception 'Enter a positive number of chapters'
      using errcode = '22023';
  end if;

  select challenge.points_per_chapter
  into challenge_rate
  from public.completions completion
  join public.challenges challenge on challenge.id = completion.challenge_id
  where completion.id = p_completion_id;
  if not found or challenge_rate is null then
    raise exception 'That chapter completion could not be found'
      using errcode = '23514';
  end if;

  calculated_points := p_chapters_read::bigint * challenge_rate;
  if calculated_points > 2147483647 then
    raise exception 'The calculated points exceed the supported limit'
      using errcode = '22003';
  end if;

  update public.completions
  set chapters_read = p_chapters_read,
      points_awarded = calculated_points::integer
  where id = p_completion_id
  returning points_awarded into updated_points;

  return updated_points;
end;
$$;

revoke all on function public.admin_update_chapter_completion(uuid, integer)
  from public, anon;
grant execute on function public.admin_update_chapter_completion(uuid, integer)
  to authenticated;
