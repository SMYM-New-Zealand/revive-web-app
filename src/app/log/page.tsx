import { AppShell } from "@/components/app-shell";
import { ChallengeLog } from "@/components/challenge-log";
import {
  competitionWeekStart,
  dateInTimeZone,
  formatCompetitionDate,
  isAvailableOnDate,
} from "@/lib/dates";
import { requireParticipant } from "@/lib/auth";
import {
  calculatePointsForDay,
  calculateTotalPoints,
  getChallengeIdsCompletedInCompetitionWeek,
} from "@/lib/points";

export default async function LogPage() {
  const { supabase, user, profile, config, isAdmin } = await requireParticipant();
  const today = dateInTimeZone(new Date(), config.timezone);

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
  const inCompetition = today >= config.starts_on && today <= config.ends_on;
  const challenges = (allChallenges ?? []).filter(
    (challenge) =>
      inCompetition && isAvailableOnDate(challenge.starts_on, challenge.ends_on, today),
  );
  const completedToday = myCompletions.filter(
    (completion) => completion.competition_day === today,
  );
  const weeklyChallengeIds = new Set(
    (allChallenges ?? [])
      .filter((challenge) => challenge.once_per_week)
      .map((challenge) => challenge.id),
  );
  const weeklyCompletedIds = getChallengeIdsCompletedInCompetitionWeek(
    myCompletions,
    competitionWeekStart(
      today < config.starts_on ? config.starts_on : today,
      config.starts_on,
    ),
  ).filter((challengeId) => weeklyChallengeIds.has(challengeId));

  return (
    <AppShell active="log" displayName={profile.display_name} isAdmin={isAdmin}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
          <span className="size-1.5 rounded-full bg-emerald-300" />
          {config.name} · {config.starts_on} — {config.ends_on}
        </div>
        <ChallengeLog
          challenges={challenges}
          initialCompletedIds={completedToday.map((completion) => completion.challenge_id)}
          initialWeeklyCompletedIds={weeklyCompletedIds}
          todayPoints={calculatePointsForDay(myCompletions, today)}
          totalPoints={calculateTotalPoints(myCompletions)}
          dateLabel={formatCompetitionDate(today)}
          today={today}
          inCompetition={inCompetition}
        />
      </div>
    </AppShell>
  );
}
