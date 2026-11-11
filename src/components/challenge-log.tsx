"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveChallengeSelection } from "@/app/actions";
import {
  competitionWeekStart,
  formatCompetitionDate,
} from "@/lib/dates";
import {
  calculatePointsForDay,
  calculateTotalPoints,
  getChallengeIdsCompletedInCompetitionWeek,
} from "@/lib/points";

type Challenge = {
  id: string;
  tier: "novice" | "challenger" | "elite" | "bonus";
  title: string;
  points: number;
  once_per_week: boolean;
};

type Completion = {
  challenge_id: string;
  competition_day: string;
  points_awarded: number;
};

type AvailableDay = {
  date: string;
  label: string;
  challenges: Challenge[];
};

const tiers: {
  key: Challenge["tier"];
  name: string;
  points: number;
  description: string;
}[] = [
  { key: "novice", name: "Novice", points: 10, description: "Small steps, steady habits" },
  { key: "challenger", name: "Challenger", points: 25, description: "Stretch yourself a little" },
  { key: "elite", name: "Elite", points: 50, description: "Go further, grow stronger" },
  { key: "bonus", name: "Bonus", points: 100, description: "Special challenges | Please note some bonus challenges are available only once per week" },
];

export function ChallengeLog({
  availableDays,
  completions,
  today,
  competitionStart,
}: {
  availableDays: AvailableDay[];
  completions: Completion[];
  today: string;
  competitionStart: string;
}) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState(
    () => availableDays.find((day) => day.date === today)?.date ?? availableDays.at(-1)?.date ?? today,
  );
  const [loggedCompletions, setLoggedCompletions] = useState(completions);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [isSaving, setIsSaving] = useState(false);
  const pendingRef = useRef(false);
  const [notice, setNotice] = useState("");

  const completionsKey = completions
    .map(({ challenge_id, competition_day, points_awarded }) =>
      `${challenge_id}:${competition_day}:${points_awarded}`,
    )
    .join(",");
  useEffect(() => {
    setLoggedCompletions(completions);
  }, [completionsKey, completions]);

  const activeDay = availableDays.find((day) => day.date === selectedDay);
  const challenges = activeDay?.challenges ?? [];
  const completedIds = new Set(
    loggedCompletions
      .filter((completion) => completion.competition_day === selectedDay)
      .map((completion) => completion.challenge_id),
  );
  const weeklyCompletedIds = new Set(
    activeDay
      ? getChallengeIdsCompletedInCompetitionWeek(
          loggedCompletions,
          competitionWeekStart(selectedDay, competitionStart),
        )
      : [],
  );
  const weeklyChallengeIds = new Set(
    challenges.filter((challenge) => challenge.once_per_week).map(({ id }) => id),
  );
  const completedThisWeek = new Set(
    [...weeklyCompletedIds].filter((challengeId) => weeklyChallengeIds.has(challengeId)),
  );
  const dayPoints = calculatePointsForDay(loggedCompletions, selectedDay);
  const totalScore = calculateTotalPoints(loggedCompletions);
  const dateLabel = activeDay?.label ?? formatCompetitionDate(selectedDay);
  const dayName = selectedDay === today ? "today" : "yesterday";

  function handleSelect(challenge: Challenge) {
    if (
      completedIds.has(challenge.id) ||
      completedThisWeek.has(challenge.id) ||
      isSaving
    ) return;
    setNotice("");
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(challenge.id)) next.delete(challenge.id);
      else next.add(challenge.id);
      return next;
    });
  }

  async function handleSave() {
    if (pendingRef.current || selectedIds.size === 0) return;
    pendingRef.current = true;
    setIsSaving(true);
    setNotice("");
    const selected = challenges.filter((challenge) => selectedIds.has(challenge.id));

    try {
      const result = await saveChallengeSelection(
        selected.map(({ id }) => id),
        selectedDay,
      );
      if (!result.ok) {
        setNotice(result.error ?? "Couldn’t save that challenge.");
        if (result.refresh) router.refresh();
      } else {
        setLoggedCompletions((current) => [
          ...current,
          ...selected.map((challenge) => ({
            challenge_id: challenge.id,
            competition_day: selectedDay,
            points_awarded: challenge.points,
          })),
        ]);
        setSelectedIds(new Set());
        router.refresh();
      }
    } catch {
      setNotice("Connection issue — your selection wasn’t saved. Please try again.");
    } finally {
      pendingRef.current = false;
      setIsSaving(false);
    }
  }

  const selectedPoints = challenges
    .filter((challenge) => selectedIds.has(challenge.id))
    .reduce((sum, challenge) => sum + challenge.points, 0);

  return (
    <div>
      <section className="mb-8 grid grid-cols-2 gap-3 sm:gap-4">
        <ScoreCard label={`${dayName === "today" ? "Today’s" : "Yesterday’s"} points`} value={dayPoints} icon="✦" />
        <ScoreCard label="Total points" value={totalScore} icon="↗" />
      </section>

      {availableDays.length > 1 && (
        <div className="mb-6 flex gap-2" aria-label="Choose a competition day">
          {availableDays.map((day) => (
            <button
              key={day.date}
              type="button"
              aria-pressed={selectedDay === day.date}
              onClick={() => {
                setSelectedDay(day.date);
                setSelectedIds(new Set());
                setNotice("");
              }}
              className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${
                selectedDay === day.date
                  ? "border-amber-200/40 bg-amber-200/10 text-amber-100"
                  : "border-white/10 bg-white/[0.04] text-white/55 hover:text-white/80"
              }`}
            >
              {day.date === today ? "Today" : "Yesterday"}
            </button>
          ))}
        </div>
      )}

      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.23em] text-amber-300">
            {activeDay ? `${dayName[0].toUpperCase()}${dayName.slice(1)}’s challenge` : "Competition"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {dateLabel}
          </h1>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
          {completedIds.size} completed {dayName}
        </span>
      </div>

      {!activeDay && (
        <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100/80">
          Neither today nor yesterday is within the competition dates. Challenges cannot be logged.
        </div>
      )}
      {notice && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] px-4 py-3 text-sm text-rose-100"
        >
          {notice}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-100/80">
            {selectedIds.size} {selectedIds.size === 1 ? "challenge" : "challenges"} selected ·{" "}
            {selectedPoints} points
          </p>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="min-h-11 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-bold text-[#1d1b14] transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save progress"}
          </button>
        </div>
      )}

      <div className="space-y-8">
        {tiers.map((tier) => {
          const items = challenges.filter((challenge) => challenge.tier === tier.key);
          if (items.length === 0) return null;
          return (
            <section key={tier.key} aria-labelledby={`${tier.key}-heading`}>
              <div
                className={`mb-3 flex items-center justify-between rounded-xl px-4 py-3 ${
                  tier.key === "bonus"
                    ? "bg-[#7b7737]"
                    : "bg-gradient-to-r from-[#c68e27] to-[#e6ad36]"
                }`}
              >
                <div>
                  <h2
                    id={`${tier.key}-heading`}
                    className="text-base font-bold text-[#1d1b14] sm:text-lg"
                  >
                    {tier.name}
                  </h2>
                  <p className="text-xs text-[#272116]/75">{tier.description}</p>
                </div>
                <span className="text-right text-sm font-bold text-[#1d1b14]">
                  {tier.points}
                  <span className="ml-1 text-xs font-medium">pts each</span>
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((challenge) => {
                  const completed = completedIds.has(challenge.id);
                  const weeklyCompleted = completedThisWeek.has(challenge.id);
                  const locked = completed || weeklyCompleted;
                  const selected = selectedIds.has(challenge.id);
                  return (
                    <button
                      key={challenge.id}
                      type="button"
                      disabled={locked || isSaving || !activeDay}
                      onClick={() => handleSelect(challenge)}
                      aria-pressed={locked || selected}
                      className={`group flex min-h-[72px] items-center gap-3 rounded-xl border p-4 text-left transition ${
                        locked
                          ? "border-emerald-300/20 bg-emerald-300/[0.07] text-white/55"
                          : selected
                            ? "border-amber-200/35 bg-amber-200/[0.09] text-white/95 hover:bg-amber-200/[0.13]"
                            : "border-white/[0.07] bg-[#20231e] text-white/90 hover:border-amber-200/30 hover:bg-[#262a23] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                      }`}
                    >
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold transition ${
                          locked
                            ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-200"
                            : selected
                              ? "border-amber-200/50 bg-amber-200/15 text-amber-200"
                              : "border-white/20 text-white/20 group-hover:border-amber-200/60 group-hover:text-amber-200"
                        }`}
                        aria-hidden="true"
                      >
                        {locked || selected ? "✓" : ""}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm leading-5 sm:text-[15px]">
                          {challenge.title}
                        </span>
                        {locked ? (
                          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-emerald-200/65">
                            {weeklyCompleted ? "Completed this week" : `Completed ${dayName}`}
                          </span>
                        ) : selected ? (
                          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-amber-200/70">
                            Selected · tap to remove
                          </span>
                        ) : challenge.once_per_week ? (
                          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-amber-200/50">
                            Once per competition week
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-amber-200/75">
                        +{challenge.points}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-8 border-t border-white/[0.08] pt-5 text-center text-xs leading-5 text-white/40">
        Selections stay editable until saved. Saved challenges lock for the selected day,
        or for the competition week when marked weekly.
      </p>
      <span className="sr-only">Competition day {selectedDay}</span>
    </div>
  );
}

function ScoreCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.09] bg-[#20231e] px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-white/50 sm:text-sm">{label}</p>
        <span className="text-amber-300">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        {value}
        <span className="ml-1.5 text-xs font-medium text-white/35 sm:text-sm">pts</span>
      </p>
    </div>
  );
}
