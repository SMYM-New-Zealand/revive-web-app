export type CompletionForPoints = {
  competition_day: string;
  points_awarded: number;
};

export function calculatePointsForDay(
  completions: CompletionForPoints[],
  competitionDay: string,
): number {
  return completions.reduce(
    (total, completion) =>
      completion.competition_day === competitionDay
        ? total + completion.points_awarded
        : total,
    0,
  );
}

export function calculateTotalPoints(completions: CompletionForPoints[]): number {
  return completions.reduce(
    (total, completion) => total + completion.points_awarded,
    0,
  );
}

export function hasCompletedChallengeToday(
  challengeId: string,
  completions: { challenge_id: string; competition_day: string }[],
  competitionDay: string,
): boolean {
  return completions.some(
    (completion) =>
      completion.challenge_id === challengeId &&
      completion.competition_day === competitionDay,
  );
}

export function getChallengeIdsCompletedInCompetitionWeek(
  completions: {
    challenge_id: string;
    competition_day: string;
  }[],
  weekStart: string,
): string[] {
  const weekEnd = new Date(
    Date.parse(`${weekStart}T00:00:00Z`) + 7 * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  return [
    ...new Set(
      completions
        .filter(
          (completion) =>
            completion.competition_day >= weekStart &&
            completion.competition_day < weekEnd,
        )
        .map((completion) => completion.challenge_id),
    ),
  ];
}
