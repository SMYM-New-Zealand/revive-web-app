update public.challenges
set starts_on = null, ends_on = null
where title = 'Historical Points';

create or replace function public.restrict_historical_points_to_admin_backfill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('revive.admin_backfill', true) is distinct from 'true'
      and exists (
        select 1
        from public.challenges challenge
        where challenge.id = new.challenge_id
          and challenge.title = 'Historical Points'
      ) then
    raise exception 'Historical Points can only be added by an admin'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger restrict_historical_points_to_admin_backfill
before insert on public.completions
for each row execute function public.restrict_historical_points_to_admin_backfill();

revoke all on function public.restrict_historical_points_to_admin_backfill()
  from public, anon, authenticated;

create or replace function public.admin_backfill_completions_with_points(
  p_user_id uuid,
  p_competition_day date,
  p_challenge_ids uuid[],
  p_custom_points integer[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only admins can backfill completions'
      using errcode = '42501';
  end if;

  if p_challenge_ids is null
      or p_custom_points is null
      or cardinality(p_challenge_ids) <> cardinality(p_custom_points) then
    raise exception 'Custom points must match the selected challenges'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(p_challenge_ids) with ordinality
      as selected(challenge_id, position)
    join pg_catalog.unnest(p_custom_points) with ordinality
      as custom(custom_points, position)
      on custom.position = selected.position
    left join public.challenges challenge on challenge.id = selected.challenge_id
    where custom.custom_points is null
      or custom.custom_points < 0
      or (
        custom.custom_points > 0
        and (
          challenge.id is null
          or challenge.title <> 'Historical Points'
        )
      )
  ) then
    raise exception 'Custom points can only be set for Historical Points'
      using errcode = '22023';
  end if;

  inserted_count := public.admin_backfill_completions(
    p_user_id,
    p_competition_day,
    p_challenge_ids
  );

  update public.completions completion
  set points_awarded = custom.custom_points
  from pg_catalog.unnest(p_challenge_ids) with ordinality
    as selected(challenge_id, position)
  join pg_catalog.unnest(p_custom_points) with ordinality
    as custom(custom_points, position)
    on custom.position = selected.position
  where custom.custom_points > 0
    and completion.user_id = p_user_id
    and completion.competition_day = p_competition_day
    and completion.challenge_id = selected.challenge_id;

  return inserted_count;
end;
$$;

revoke all on function public.admin_backfill_completions_with_points(
  uuid, date, uuid[], integer[]
) from public, anon;
grant execute on function public.admin_backfill_completions_with_points(
  uuid, date, uuid[], integer[]
) to authenticated;
