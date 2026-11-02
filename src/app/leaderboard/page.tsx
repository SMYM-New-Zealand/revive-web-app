import { AppShell } from "@/components/app-shell";
import { LeaderboardLive } from "@/components/leaderboard-live";
import { dateInTimeZone } from "@/lib/dates";
import { requireParticipant } from "@/lib/auth";

export default async function LeaderboardPage() {
  const { supabase, user, profile, config, isAdmin } = await requireParticipant();
  const today = dateInTimeZone(new Date(), config.timezone);
  const { data: rows, error } = await supabase.rpc("leaderboard_for_day", {
    p_competition_day: today,
  });
  if (error) throw new Error(`Could not load leaderboard: ${error.message}`);

  return (
    <AppShell
      active="leaderboard"
      displayName={profile.display_name}
      isAdmin={isAdmin}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.23em] text-amber-300">
            Growing together
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="mt-2 text-sm text-white/50">
            Points earned today and throughout the competition.
          </p>
        </div>
        <LeaderboardLive rows={rows ?? []} currentUserId={user.id} />
      </div>
    </AppShell>
  );
}
