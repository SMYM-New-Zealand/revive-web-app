import { AppShell } from "@/components/app-shell";
import { ChallengeLog } from "@/components/challenge-log";
import {
  addCompetitionDays,
  dateInTimeZone,
  formatCompetitionDate,
  isAvailableOnDate,
} from "@/lib/dates";
import { requireParticipant } from "@/lib/auth";

export default async function LogPage() {
  const { supabase, user, profile, config, isAdmin } = await requireParticipant();
  const today = dateInTimeZone(new Date(), config.timezone);
  const yesterday = addCompetitionDays(today, -1);

  const [{ data: allChallenges, error: challengeError }, { data: completions, error: completionError }] =
    await Promise.all([
      supabase.from("challenges").select("*").eq("active", true).order("sort_order"),
      supabase
        .from("completions")
        .select("challenge_id, competition_day, points_awarded")
        .eq("user_id", user.id),
    ]);

  if (challengeError) throw new Error(`Could not load challenges: ${challengeError.message}`);
  if (completionError) throw new Error(`Could not load your points: ${completionError.message}`);

  const myCompletions = completions ?? [];
  const availableDays = [yesterday, today]
    .filter((day) => day >= config.starts_on && day <= config.ends_on)
    .map((day) => ({
      date: day,
      label: formatCompetitionDate(day),
      challenges: (allChallenges ?? []).filter((challenge) =>
        isAvailableOnDate(challenge.starts_on, challenge.ends_on, day),
      ),
    }));

  return (
    <AppShell active="log" displayName={profile.display_name} isAdmin={isAdmin}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
          <span className="size-1.5 rounded-full bg-emerald-300" />
          {config.name} · {config.starts_on} — {config.ends_on}
        </div>
        <ChallengeLog
          availableDays={availableDays}
          completions={myCompletions}
          today={today}
          competitionStart={config.starts_on}
        />
      </div>
    </AppShell>
  );
}
