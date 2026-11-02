import { describe, expect, it } from "vitest";
import {
  calculatePointsForDay,
  calculateTotalPoints,
  hasCompletedChallengeToday,
} from "./points";

describe("points", () => {
  const completions = [
    { competition_day: "2026-11-02", points_awarded: 10 },
    { competition_day: "2026-11-02", points_awarded: 25 },
    { competition_day: "2026-11-03", points_awarded: 50 },
  ];

  it("calculates points for only the requested competition day", () => {
    expect(calculatePointsForDay(completions, "2026-11-02")).toBe(35);
    expect(calculatePointsForDay(completions, "2026-11-04")).toBe(0);
  });

  it("calculates total points across every day", () => {
    expect(calculateTotalPoints(completions)).toBe(85);
  });

  it("locks a challenge only for the competition day it was completed", () => {
    const entries = [
      { challenge_id: "squats", competition_day: "2026-11-02" },
    ];
    expect(hasCompletedChallengeToday("squats", entries, "2026-11-02")).toBe(true);
    expect(hasCompletedChallengeToday("squats", entries, "2026-11-03")).toBe(false);
    expect(hasCompletedChallengeToday("pushups", entries, "2026-11-02")).toBe(false);
  });
});
