import { AppShell } from "@/components/app-shell";
import { LeaderboardLive } from "@/components/leaderboard-live";
import { dateInTimeZone } from "@/lib/dates";
import { requireParticipant } from "@/lib/auth";

export default async function LeaderboardPage() {
  const { supabase, user, profile, config, isAdmin } = await requireParticipant();
  const today = dateInTimeZone(new Date(), config.timezone);
  const [leaderboardResult, participantGenderResult] = await Promise.all([
    supabase.rpc("leaderboard_for_day", { p_competition_day: today }),
    supabase.rpc("current_user_gender", {}),
  ]);
  if (leaderboardResult.error) {
    throw new Error(`Could not load leaderboard: ${leaderboardResult.error.message}`);
  }
  if (participantGenderResult.error) {
    throw new Error(
      `Could not load your leaderboard access: ${participantGenderResult.error.message}`,
    );
  }

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
        {!isAdmin && !participantGenderResult.data ? (
          <div
            role="status"
            className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100/80"
          >
            Your gender hasn’t been set for this competition account yet. Please
            contact an admin to update your allowlist entry.
          </div>
        ) : null}
        <LeaderboardLive
          rows={leaderboardResult.data ?? []}
          currentUserId={user.id}
          isAdmin={isAdmin}
        />
      </div>
    </AppShell>
  );
}
