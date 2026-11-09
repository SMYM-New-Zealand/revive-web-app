alter table public.challenges
  add column target_gender text not null default 'unisex';

alter table public.challenges
  add constraint challenges_target_gender_check
  check (target_gender in ('male', 'female', 'unisex'));

alter table public.challenges
  drop constraint challenges_tier_title_key,
  add constraint challenges_tier_title_target_gender_key
    unique (tier, title, target_gender);

drop policy "Allowed participants can read challenges" on public.challenges;
create policy "Participants can read eligible challenges"
on public.challenges for select to authenticated
using (
  public.is_admin()
  or (
    public.is_allowed_user()
    and (
      target_gender = 'unisex'
      or target_gender = public.current_user_gender()
    )
  )
);

create or replace function public.enforce_challenge_gender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge_gender text;
  participant_gender text;
begin
  select challenge.target_gender
  into challenge_gender
  from public.challenges challenge
  where challenge.id = new.challenge_id;

  if not found then
    raise exception 'This challenge is not available'
      using errcode = '23514';
  end if;

  select allowed.gender
  into participant_gender
  from public.profiles profile
  join public.allowed_emails allowed
    on lower(allowed.email) = lower(profile.email)
  where profile.id = new.user_id;

  if not found or (
    challenge_gender <> 'unisex'
    and challenge_gender is distinct from participant_gender
  ) then
    raise exception 'This challenge is not available for this participant'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger enforce_challenge_gender
before insert on public.completions
for each row execute function public.enforce_challenge_gender();

revoke all on function public.enforce_challenge_gender()
  from public, anon, authenticated;
