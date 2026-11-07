"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dateInTimeZone, isAvailableOnDate } from "@/lib/dates";
import { requireParticipant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign out failed:", error.message);
    throw new Error("Could not sign out. Please try again.");
  }
  redirect("/");
}

export type CompletionActionResult = {
  ok: boolean;
  error?: string;
  refresh?: boolean;
};

export async function saveChallengeSelection(
  challengeIds: string[],
): Promise<CompletionActionResult> {
  const { supabase, user, config } = await requireParticipant();
  const today = dateInTimeZone(new Date(), config.timezone);
  if (today < config.starts_on || today > config.ends_on) {
    return { ok: false, error: "Today is outside the competition dates." };
  }
  const uniqueChallengeIds = [...new Set(challengeIds)];
  if (
    uniqueChallengeIds.length === 0 ||
    uniqueChallengeIds.length !== challengeIds.length
  ) {
    return { ok: false, error: "Select at least one different challenge to save." };
  }

  const { data: challenges, error: challengeError } = await supabase
    .from("challenges")
    .select("id, points, active, starts_on, ends_on")
    .in("id", uniqueChallengeIds);

  if (challengeError) {
    console.error("Challenge availability check failed:", challengeError.message);
    return { ok: false, error: "Couldn’t check those challenges. Please refresh and try again." };
  }
  if (
    !challenges ||
    challenges.length !== uniqueChallengeIds.length ||
    challenges.some(
      (challenge) =>
        !challenge.active ||
        !isAvailableOnDate(challenge.starts_on, challenge.ends_on, today),
    )
  ) {
    return { ok: false, error: "One or more selected challenges aren’t available today." };
  }

  const { error } = await supabase.from("completions").insert(
    challenges.map((challenge) => ({
      user_id: user.id,
      challenge_id: challenge.id,
      competition_day: today,
      points_awarded: challenge.points,
    })),
  );

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "At least one selected challenge is already saved today or has reached its weekly limit. Review your selection and try again.",
        refresh: true,
      };
    }
    if (error.code === "23514") {
      return {
        ok: false,
        error: "These challenges can’t be saved for today. Refresh and try again.",
      };
    }
    console.error("Challenge selection save failed:", error.message);
    return { ok: false, error: "Couldn’t save your selection. Please try again." };
  }

  revalidatePath("/log");
  revalidatePath("/leaderboard");
  return { ok: true };
}

export type AdminActionState = {
  message: string;
  success: boolean;
};

export async function backfillCompletions(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase, config } = await requireAdmin();
  const participantId = String(formData.get("user_id") ?? "");
  const competitionDay = String(formData.get("competition_day") ?? "");
  const challengeIds = formData
    .getAll("challenge_ids")
    .map(String)
    .filter(Boolean);

  if (!participantId || !isDate(competitionDay) || challengeIds.length === 0) {
    return {
      message: "Choose a participant, past competition date, and at least one challenge.",
      success: false,
    };
  }

  const today = dateInTimeZone(new Date(), config.timezone);
  if (
    competitionDay < config.starts_on ||
    competitionDay > config.ends_on ||
    competitionDay >= today
  ) {
    return {
      message: "Choose a past competition day within the competition dates.",
      success: false,
    };
  }

  const { data: insertedCount, error } = await supabase.rpc("admin_backfill_completions", {
    p_user_id: participantId,
    p_competition_day: competitionDay,
    p_challenge_ids: challengeIds,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        message:
          "At least one challenge is already logged for that day or competition week. No entries were added.",
        success: false,
      };
    }
    if (error.code === "23514" || error.code === "22023") {
      return {
        message:
          "The selected participant, date, or challenges do not meet the competition rules. No entries were added.",
        success: false,
      };
    }
    if (error.code === "42501") {
      return {
        message: "Only an admin can add late completion entries.",
        success: false,
      };
    }
    console.error("Admin completion backfill failed:", error.message);
    return {
      message: "Could not add those completions. No entries were added.",
      success: false,
    };
  }

  if (insertedCount !== challengeIds.length) {
    console.error("Admin completion backfill returned an unexpected insert count.");
    return {
      message: "Could not confirm all selected completions were added. Refresh and check the participant log.",
      success: false,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/log");
  revalidatePath("/leaderboard");
  return {
    message: `${insertedCount} late completion${insertedCount === 1 ? "" : "s"} added.`,
    success: true,
  };
}

function isChallengeTier(
  tier: string,
): tier is "novice" | "challenger" | "elite" | "bonus" {
  return tier === "novice" || tier === "challenger" || tier === "elite" || tier === "bonus";
}

async function requireAdmin() {
  const context = await requireParticipant();
  if (!context.isAdmin) redirect("/log");
  return context;
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export async function addChallenge(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const tier = String(formData.get("tier") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const points = Number(formData.get("points"));
  const startsOn = String(formData.get("starts_on") ?? "") || null;
  const endsOn = String(formData.get("ends_on") ?? "") || null;
  const oncePerWeek = formData.get("once_per_week") === "on";

  if (!isChallengeTier(tier) || !title || !Number.isInteger(points) || points <= 0) {
    return { message: "Enter a tier, title, and positive whole-number points.", success: false };
  }
  if (
    (startsOn && !isDate(startsOn)) ||
    (endsOn && !isDate(endsOn)) ||
    (startsOn && endsOn && startsOn > endsOn)
  ) {
    return { message: "Enter valid availability dates in the right order.", success: false };
  }

  const { error } = await supabase.from("challenges").insert({
    tier,
    title,
    points,
    starts_on: startsOn,
    ends_on: endsOn,
    once_per_week: oncePerWeek,
  });
  if (error) {
    if (error.code === "23505") {
      return { message: "A challenge with that title already exists in this tier.", success: false };
    }
    console.error("Admin challenge creation failed:", error.message);
    return { message: "Could not add that challenge. Please try again.", success: false };
  }
  revalidatePath("/admin");
  revalidatePath("/log");
  return { message: "Challenge added.", success: true };
}

export async function deactivateChallenge(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("challenge_id") ?? "");
  if (!id) return { message: "Choose a challenge to deactivate.", success: false };
  const { error } = await supabase
    .from("challenges")
    .update({ active: false })
    .eq("id", id);
  if (error) {
    console.error("Admin challenge deactivation failed:", error.message);
    return { message: "Could not deactivate that challenge.", success: false };
  }
  revalidatePath("/admin");
  revalidatePath("/log");
  return { message: "Challenge deactivated.", success: true };
}

export async function reactivateChallenge(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("challenge_id") ?? "");
  if (!id) return { message: "Choose a challenge to reactivate.", success: false };

  const { data, error } = await supabase
    .from("challenges")
    .update({ active: true })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Admin challenge reactivation failed:", error.message);
    return { message: "Could not reactivate that challenge.", success: false };
  }
  if (!data) return { message: "That challenge could not be found.", success: false };

  revalidatePath("/admin");
  revalidatePath("/log");
  return { message: "Challenge reactivated.", success: true };
}

export async function setChallengeWeeklyLimit(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("challenge_id") ?? "");
  const oncePerWeek = formData.get("once_per_week") === "on";
  if (!id) return { message: "Choose a challenge to update.", success: false };

  const { data, error } = await supabase
    .from("challenges")
    .update({ once_per_week: oncePerWeek })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Challenge weekly limit update failed:", error.message);
    return { message: "Could not update the weekly limit.", success: false };
  }
  if (!data) return { message: "That challenge could not be found.", success: false };
  revalidatePath("/admin");
  revalidatePath("/log");
  return { message: "Weekly limit updated.", success: true };
}

export async function addAllowedEmail(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { message: "Enter a valid email address.", success: false };
  }

  const { error } = await supabase
    .from("allowed_emails")
    .insert({ email, is_admin: false });
  if (error) {
    if (error.code === "23505") {
      return { message: "That email is already on the allowlist.", success: false };
    }
    console.error("Admin allowlist update failed:", error.message);
    return { message: "Could not add that email.", success: false };
  }
  revalidatePath("/admin");
  return { message: "Email added to the allowlist.", success: true };
}

export async function promoteAllowedEmails(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const submittedEmails = formData.getAll("emails");
  if (
    submittedEmails.length === 0 ||
    submittedEmails.some((value) => typeof value !== "string")
  ) {
    return { message: "Select at least one participant to promote.", success: false };
  }

  const emails = [...new Set(
    submittedEmails.map((value) => String(value).trim().toLowerCase()),
  )];
  if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { message: "The participant selection is invalid. Refresh and try again.", success: false };
  }

  const { data, error } = await supabase
    .from("allowed_emails")
    .update({ is_admin: true })
    .in("email", emails)
    .eq("is_admin", false)
    .select("email");
  if (error) {
    console.error("Admin promotion failed:", error.message);
    return { message: "Could not promote the selected participants.", success: false };
  }
  if (!data?.length) {
    return { message: "No selected participants needed admin access.", success: false };
  }

  revalidatePath("/admin");
  return {
    message: `${data.length} participant${data.length === 1 ? "" : "s"} promoted to admin.`,
    success: true,
  };
}

export async function updateCompetition(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const startsOn = String(formData.get("starts_on") ?? "");
  const endsOn = String(formData.get("ends_on") ?? "");
  if (!isDate(startsOn) || !isDate(endsOn) || startsOn > endsOn) {
    return { message: "Enter valid competition dates in the right order.", success: false };
  }

  const { error } = await supabase
    .from("competition_config")
    .update({ starts_on: startsOn, ends_on: endsOn })
    .eq("id", 1);
  if (error) {
    console.error("Competition settings update failed:", error.message);
    return { message: "Could not update the competition dates.", success: false };
  }
  revalidatePath("/admin");
  revalidatePath("/log");
  revalidatePath("/leaderboard");
  return { message: "Competition dates updated.", success: true };
}
