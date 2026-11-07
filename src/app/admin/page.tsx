import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminForms } from "@/components/admin-forms";
import { addCompetitionDays, dateInTimeZone } from "@/lib/dates";
import { requireParticipant } from "@/lib/auth";

export default async function AdminPage() {
  const { supabase, profile, config, isAdmin } = await requireParticipant();
  if (!isAdmin) redirect("/log");

  const [
    { data: challenges, error: challengeError },
    { data: allowedEmails, error: emailsError },
    { data: participants, error: participantsError },
  ] = await Promise.all([
    supabase.from("challenges").select("*").order("tier").order("sort_order"),
    supabase.from("allowed_emails").select("email, is_admin, gender").order("email"),
    supabase.from("profiles").select("id, display_name, email").order("display_name"),
  ]);
  if (challengeError) throw new Error(`Could not load challenges: ${challengeError.message}`);
  if (emailsError) throw new Error(`Could not load allowlist: ${emailsError.message}`);
  if (participantsError) throw new Error(`Could not load participants: ${participantsError.message}`);
  const latestCompetitionDay = dateInTimeZone(new Date(), config.timezone);
  const previousCompetitionDay = addCompetitionDays(latestCompetitionDay, -1);
  const maxBackfillDate =
    previousCompetitionDay < config.ends_on
      ? previousCompetitionDay
      : config.ends_on;

  return (
    <AppShell active="admin" displayName={profile.display_name} isAdmin={isAdmin}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.23em] text-amber-300">
            Competition settings
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-2 text-sm text-white/50">
            Manage the rubric, participants, and competition dates.
          </p>
        </div>
        <AdminForms
          challenges={challenges ?? []}
          allowedEmails={allowedEmails ?? []}
          participants={participants ?? []}
          startsOn={config.starts_on}
          endsOn={config.ends_on}
          maxBackfillDate={maxBackfillDate}
        />
      </div>
    </AppShell>
  );
}
