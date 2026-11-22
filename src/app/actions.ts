"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  dateInTimeZone,
  isAvailableOnDate,
  isTodayOrYesterday,
} from "@/lib/dates";
import { calculateChapterPoints } from "@/lib/chapter-points";
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
  competitionDay: string,
  chaptersRead?: number,
): Promise<CompletionActionResult> {
  const { supabase, user, config } = await requireParticipant();
  const today = dateInTimeZone(new Date(), config.timezone);
  if (
    !isTodayOrYesterday(competitionDay, today) ||
    competitionDay < config.starts_on ||
    competitionDay > config.ends_on
  ) {
    return { ok: false, error: "Choose today or yesterday within the competition dates." };
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
    .select("id, points, points_per_chapter, active, starts_on, ends_on, target_gender, once_per_week")
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
        !isAvailableOnDate(challenge.starts_on, challenge.ends_on, competitionDay),
    )
  ) {
    return {
      ok: false,
      error: "One or more selected challenges aren’t available on that date.",
    };
  }
  const { data: participantGender, error: genderError } = await supabase.rpc(
    "current_user_gender",
    {},
  );
  if (genderError) {
    console.error("Challenge gender check failed:", genderError.message);
    return { ok: false, error: "Couldn’t verify challenge access. Please refresh and try again." };
  }
  if (
    challenges.some(
      (challenge) =>
        challenge.target_gender !== "unisex" &&
        challenge.target_gender !== participantGender,
    )
  ) {
    return {
      ok: false,
      error: "One or more selected challenges aren’t available for your participant profile.",
    };
  }
  const chapterChallenge = challenges.find(
    (challenge) => challenge.points_per_chapter !== null,
  );
  const chapterPoints =
    chapterChallenge &&
    chapterChallenge.points_per_chapter !== null &&
    challenges.length === 1 &&
    chaptersRead !== undefined
      ? calculateChapterPoints(chaptersRead, chapterChallenge.points_per_chapter)
      : null;
  if (
    (chapterChallenge &&
      (challenges.length !== 1 || chapterPoints === null)) ||
    (!chapterChallenge && chaptersRead !== undefined)
  ) {
    return {
      ok: false,
      error: "Enter a valid chapter count for this challenge.",
    };
  }
  if (chapterChallenge && chapterChallenge.once_per_week) {
    return {
      ok: false,
      error: "Chapter-count challenges must be available for a daily entry.",
    };
  }

  const { error } = await supabase.from("completions").insert(
    challenges.map((challenge) => ({
      user_id: user.id,
      challenge_id: challenge.id,
      competition_day: competitionDay,
      points_awarded: challenge.points,
      chapters_read: chapterChallenge ? chaptersRead ?? null : null,
    })),
  );

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "At least one selected challenge is already saved for that date or has reached its weekly limit. Review your selection and try again.",
        refresh: true,
      };
    }
    if (error.code === "23514") {
      return {
        ok: false,
        error: "These challenges can’t be saved for that date. Refresh and try again.",
      };
    }
    if (error.code === "22003") {
      return {
        ok: false,
        error: "That chapter count is too large to calculate points.",
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

export type ParticipantDayCompletion = {
  id: string;
  challengeId: string;
  title: string;
  points: number;
  chaptersRead: number | null;
  pointsPerChapter: number | null;
};

export type ParticipantDayCompletionsResult =
  | { success: true; completions: ParticipantDayCompletion[] }
  | { success: false; message: string };

export async function loadParticipantDayCompletions(
  participantId: string,
  competitionDay: string,
): Promise<ParticipantDayCompletionsResult> {
  const { supabase, config } = await requireAdmin();
  if (
    !participantId ||
    !isDate(competitionDay) ||
    competitionDay < config.starts_on ||
    competitionDay > config.ends_on
  ) {
    return { success: false, message: "Choose a participant and a day within the competition dates." };
  }

  const { data: completions, error: completionError } = await supabase
    .from("completions")
    .select("id, challenge_id, points_awarded, chapters_read")
    .eq("user_id", participantId)
    .eq("competition_day", competitionDay);
  if (completionError) {
    console.error("Participant day completions lookup failed:", completionError.message);
    return { success: false, message: "Could not load completions for that day. Please try again." };
  }

  const challengeIds = [...new Set((completions ?? []).map(({ challenge_id }) => challenge_id))];
  if (challengeIds.length === 0) return { success: true, completions: [] };

  const { data: challenges, error: challengeError } = await supabase
    .from("challenges")
    .select("id, title, points_per_chapter")
    .in("id", challengeIds);
  if (challengeError) {
    console.error("Participant day challenge lookup failed:", challengeError.message);
    return { success: false, message: "Could not load challenge details for that day. Please try again." };
  }

  const challengeDetails = new Map<string, {
    title: string;
    pointsPerChapter: number | null;
  }>(
    (challenges ?? []).map(({ id, title, points_per_chapter }) => [
      id,
      { title, pointsPerChapter: points_per_chapter },
    ] as const),
  );
  return {
    success: true,
    completions: (completions ?? []).map(({ id, challenge_id, points_awarded, chapters_read }) => ({
      id,
      challengeId: challenge_id,
      title: challengeDetails.get(challenge_id)?.title ?? "Challenge",
      points: points_awarded,
      chaptersRead: chapters_read,
      pointsPerChapter: challengeDetails.get(challenge_id)?.pointsPerChapter ?? null,
    })),
  };
}

export async function updateChapterCompletion(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const completionId = String(formData.get("completion_id") ?? "");
  const chaptersRead = Number(formData.get("chapters_read"));
  if (
    !completionId ||
    !Number.isSafeInteger(chaptersRead) ||
    chaptersRead <= 0 ||
    chaptersRead > 2_147_483_647
  ) {
    return { message: "Enter a valid positive chapter count.", success: false };
  }

  const { error } = await supabase.rpc("admin_update_chapter_completion", {
    p_completion_id: completionId,
    p_chapters_read: chaptersRead,
  });
  if (error) {
    if (error.code === "22003" || error.code === "22023" || error.code === "23514") {
      return { message: "That chapter count could not be saved.", success: false };
    }
    if (error.code === "42501") {
      return { message: "Only an admin can correct completion entries.", success: false };
    }
    console.error("Admin chapter completion correction failed:", error.message);
    return { message: "Could not correct that completion. Please try again.", success: false };
  }

  revalidatePath("/admin");
  revalidatePath("/log");
  revalidatePath("/leaderboard");
  return { message: "Chapter count corrected.", success: true };
}

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
  const customPoints = challengeIds.map((challengeId) => {
    const rawPoints = String(formData.get(`custom_points_${challengeId}`) ?? "").trim();
    if (!rawPoints) return 0;
    const points = Number(rawPoints);
    return Number.isSafeInteger(points) && points > 0 && points <= 2_147_483_647
      ? points
      : Number.NaN;
  });

  if (!participantId || !isDate(competitionDay) || challengeIds.length === 0) {
    return {
      message: "Choose a participant, past competition date, and at least one challenge.",
      success: false,
    };
  }
  if (customPoints.some((points) => Number.isNaN(points))) {
    return {
      message: "Custom points must be a positive whole number.",
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

  const { data: insertedCount, error } = await supabase.rpc(
    "admin_backfill_completions_with_points",
    {
      p_user_id: participantId,
      p_competition_day: competitionDay,
      p_challenge_ids: challengeIds,
      p_custom_points: customPoints,
    },
  );

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
  const targetGender = String(formData.get("target_gender") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const points = Number(formData.get("points"));
  const rawPointsPerChapter = String(formData.get("points_per_chapter") ?? "").trim();
  const pointsPerChapter = rawPointsPerChapter ? Number(rawPointsPerChapter) : null;
  const startsOn = String(formData.get("starts_on") ?? "") || null;
  const endsOn = String(formData.get("ends_on") ?? "") || null;
  const oncePerWeek = formData.get("once_per_week") === "on";

  if (
    !isChallengeTier(tier) ||
    !isChallengeGender(targetGender) ||
    !title ||
    !Number.isInteger(points) ||
    points <= 0 ||
    (pointsPerChapter !== null && oncePerWeek) ||
    (pointsPerChapter !== null &&
      (!Number.isSafeInteger(pointsPerChapter) ||
        pointsPerChapter <= 0 ||
        pointsPerChapter > 2_147_483_647))
  ) {
    return {
      message: "Enter valid challenge points; chapter-count challenges must be daily.",
      success: false,
    };
  }
  if (
    (startsOn && !isDate(startsOn)) ||
    (endsOn && !isDate(endsOn)) ||
    (startsOn && endsOn && startsOn > endsOn)
  ) {
    return { message: "Enter valid availability dates in the right order.", success: false };
  }

  const challenge = {
    tier,
    target_gender: targetGender,
    title,
    points,
    points_per_chapter: pointsPerChapter,
    starts_on: startsOn,
    ends_on: endsOn,
    once_per_week: oncePerWeek,
  };
  const { data: existingChallenge, error: existingChallengeError } = await supabase
    .from("challenges")
    .select("id, active")
    .eq("tier", tier)
    .eq("title", title)
    .eq("target_gender", targetGender)
    .maybeSingle();
  if (existingChallengeError) {
    console.error("Admin challenge lookup failed:", existingChallengeError.message);
    return { message: "Could not add that challenge. Please try again.", success: false };
  }
  if (existingChallenge) {
    if (existingChallenge.active) {
      return {
        message: "A challenge with that title already exists in this tier for that gender.",
        success: false,
      };
    }

    const { data: reactivatedChallenge, error } = await supabase
      .from("challenges")
      .update({ ...challenge, active: true })
      .eq("id", existingChallenge.id)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("Admin challenge reactivation failed:", error.message);
      return { message: "Could not reactivate that challenge. Please try again.", success: false };
    }
    if (!reactivatedChallenge) {
      return { message: "That challenge could not be found.", success: false };
    }

    revalidatePath("/admin");
    revalidatePath("/log");
    return { message: "Challenge reactivated.", success: true };
  }

  const { error } = await supabase.from("challenges").insert(challenge);
  if (error) {
    if (error.code === "23505") {
      return {
        message: "A challenge with that title already exists in this tier for that gender.",
        success: false,
      };
    }
    console.error("Admin challenge creation failed:", error.message);
    return { message: "Could not add that challenge. Please try again.", success: false };
  }
  revalidatePath("/admin");
  revalidatePath("/log");
  return { message: "Challenge added.", success: true };
}

function isChallengeGender(
  gender: string,
): gender is "male" | "female" | "unisex" {
  return gender === "male" || gender === "female" || gender === "unisex";
}

export async function updateChallenge(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("challenge_id") ?? "");
  const tier = String(formData.get("tier") ?? "");
  const targetGender = String(formData.get("target_gender") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const points = Number(formData.get("points"));
  const rawPointsPerChapter = String(formData.get("points_per_chapter") ?? "").trim();
  const pointsPerChapter = rawPointsPerChapter ? Number(rawPointsPerChapter) : null;
  const startsOn = String(formData.get("starts_on") ?? "") || null;
  const endsOn = String(formData.get("ends_on") ?? "") || null;
  const oncePerWeek = formData.get("once_per_week") === "on";

  if (
    !id ||
    !isChallengeTier(tier) ||
    !isChallengeGender(targetGender) ||
    !title ||
    !Number.isInteger(points) ||
    points <= 0 ||
    (pointsPerChapter !== null && oncePerWeek) ||
    (pointsPerChapter !== null &&
      (!Number.isSafeInteger(pointsPerChapter) ||
        pointsPerChapter <= 0 ||
        pointsPerChapter > 2_147_483_647))
  ) {
    return {
      message: "Enter valid challenge points; chapter-count challenges must be daily.",
      success: false,
    };
  }
  if (
    (startsOn && !isDate(startsOn)) ||
    (endsOn && !isDate(endsOn)) ||
    (startsOn && endsOn && startsOn > endsOn)
  ) {
    return { message: "Enter valid availability dates in the right order.", success: false };
  }

  const { data, error } = await supabase
    .from("challenges")
    .update({
      tier,
      target_gender: targetGender,
      title,
      points,
      points_per_chapter: pointsPerChapter,
      starts_on: startsOn,
      ends_on: endsOn,
      once_per_week: oncePerWeek,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return {
        message: "A challenge with that title already exists in this tier for that gender.",
        success: false,
      };
    }
    console.error("Admin challenge update failed:", error.message);
    return { message: "Could not update that challenge. Please try again.", success: false };
  }
  if (!data) return { message: "That challenge could not be found.", success: false };

  revalidatePath("/admin");
  revalidatePath("/log");
  revalidatePath("/leaderboard");
  return { message: "Challenge updated.", success: true };
}

export async function setChallengeActive(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("challenge_id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) {
    return {
      message: `Choose a challenge to ${active ? "activate" : "deactivate"}.`,
      success: false,
    };
  }

  const { data, error } = await supabase
    .from("challenges")
    .update({ active })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Admin challenge status update failed:", error.message);
    return {
      message: `Could not ${active ? "activate" : "deactivate"} that challenge.`,
      success: false,
    };
  }
  if (!data) return { message: "That challenge could not be found.", success: false };

  revalidatePath("/admin");
  revalidatePath("/log");
  return {
    message: `Challenge ${active ? "activated" : "deactivated"}.`,
    success: true,
  };
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
