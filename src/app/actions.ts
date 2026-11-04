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
};

export async function completeChallenge(
  challengeId: string,
): Promise<CompletionActionResult> {
  const { supabase, user, config } = await requireParticipant();
  const today = dateInTimeZone(new Date(), config.timezone);
  if (today < config.starts_on || today > config.ends_on) {
    return { ok: false, error: "Today is outside the competition dates." };
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id, points, active, starts_on, ends_on")
    .eq("id", challengeId)
    .maybeSingle();

  if (challengeError) {
    console.error("Challenge availability check failed:", challengeError.message);
    return { ok: false, error: "Couldn’t check that challenge. Please refresh and try again." };
  }
  if (!challenge) {
    return { ok: false, error: "That challenge could not be found." };
  }
  if (
    !challenge.active ||
    !isAvailableOnDate(challenge.starts_on, challenge.ends_on, today)
  ) {
    return { ok: false, error: "That challenge is not available today." };
  }

  const { error } = await supabase.from("completions").insert({
    user_id: user.id,
    challenge_id: challenge.id,
    competition_day: today,
    points_awarded: challenge.points,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Already recorded today — this challenge is locked until tomorrow.",
      };
    }
    if (error.code === "23514") {
      return {
        ok: false,
        error: "This challenge can’t be recorded for today. Refresh and try again.",
      };
    }
    console.error("Challenge completion insert failed:", error.message);
    return { ok: false, error: "Couldn’t save that challenge. Please try again." };
  }

  revalidatePath("/log");
  revalidatePath("/leaderboard");
  return { ok: true };
}

export type AdminActionState = {
  message: string;
  success: boolean;
};

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

export async function addAllowedEmail(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const isAdmin = formData.get("is_admin") === "on";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { message: "Enter a valid email address.", success: false };
  }

  const { error } = await supabase
    .from("allowed_emails")
    .insert({ email, is_admin: isAdmin });
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
