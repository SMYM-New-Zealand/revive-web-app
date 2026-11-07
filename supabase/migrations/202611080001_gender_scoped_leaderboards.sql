alter table public.allowed_emails
  add column if not exists gender text;

update public.allowed_emails
set gender = lower(btrim(gender))
where gender is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.allowed_emails'::regclass
      and conname = 'allowed_emails_gender_check'
  ) then
    alter table public.allowed_emails
      add constraint allowed_emails_gender_check
      check (gender is null or gender in ('male', 'female'));
  end if;
end;
$$;

create or replace function public.current_user_gender()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select gender
  from public.allowed_emails
  where lower(email) = lower(auth.jwt() ->> 'email')
  limit 1;
$$;

drop view public.leaderboard;

create view public.leaderboard
with (security_barrier = true)
as
select
  rank() over (
    partition by email_entry.gender
    order by coalesce(sum(completion.points_awarded), 0) desc
  ) as rank,
  profile.id as user_id,
  profile.display_name,
  email_entry.gender,
  coalesce(sum(completion.points_awarded), 0)::bigint as total_points
from public.profiles profile
join public.allowed_emails email_entry
  on lower(email_entry.email) = lower(profile.email)
left join public.completions completion on completion.user_id = profile.id
where public.is_admin()
  or (
    email_entry.gender is not null
    and email_entry.gender = public.current_user_gender()
  )
group by profile.id, profile.display_name, email_entry.gender;

drop function public.leaderboard_for_day(date);

create function public.leaderboard_for_day(p_competition_day date)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  gender text,
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
      profile.id,
      profile.display_name,
      email_entry.gender,
      coalesce(sum(completion.points_awarded) filter (
        where completion.competition_day = p_competition_day
      ), 0)::bigint as day_points,
      coalesce(sum(completion.points_awarded), 0)::bigint as all_points
    from public.profiles profile
    join public.allowed_emails email_entry
      on lower(email_entry.email) = lower(profile.email)
    left join public.completions completion on completion.user_id = profile.id
    where public.is_admin()
      or (
        email_entry.gender is not null
        and email_entry.gender = public.current_user_gender()
      )
    group by profile.id, profile.display_name, email_entry.gender
  )
  select
    rank() over (partition by scores.gender order by scores.all_points desc),
    scores.id,
    scores.display_name,
    scores.gender,
    scores.day_points,
    scores.all_points
  from scores
  order by scores.gender, 1;
$$;

revoke all on function public.leaderboard_for_day(date) from public, anon;
grant execute on function public.leaderboard_for_day(date) to authenticated;

drop policy "Allowed participants can read profiles" on public.profiles;
create policy "Participants can read their own profile and admins can read all"
on public.profiles for select to authenticated
using (
  public.is_admin()
  or id = auth.uid()
);

revoke all on function public.current_user_gender() from public, anon;
grant execute on function public.current_user_gender() to authenticated;
grant select on public.leaderboard to authenticated;
