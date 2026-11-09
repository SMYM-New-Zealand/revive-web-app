import { describe, expect, it } from "vitest";
import {
  calculatePointsForDay,
  calculateTotalPoints,
  getChallengeIdsCompletedInCompetitionWeek,
  hasCompletedChallengeToday,
} from "./points";
import {
  addCompetitionDays,
  competitionWeekStart,
  dateInTimeZone,
  isTodayOrYesterday,
} from "./dates";

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

  describe("competition calendar", () => {
    it("uses a 4am competition-day boundary in the configured timezone", () => {
      expect(dateInTimeZone(new Date("2026-11-04T14:59:59Z"), "Pacific/Auckland"))
        .toBe("2026-11-04");
      expect(dateInTimeZone(new Date("2026-11-04T15:00:00Z"), "Pacific/Auckland"))
        .toBe("2026-11-05");
    });

    it("groups weekly challenges into seven-day periods from competition start", () => {
      expect(competitionWeekStart("2026-11-02", "2026-11-02")).toBe("2026-11-02");
      expect(competitionWeekStart("2026-11-08", "2026-11-02")).toBe("2026-11-02");
      expect(competitionWeekStart("2026-11-09", "2026-11-02")).toBe("2026-11-09");
    });

    it("calculates a previous competition day for admin backfills", () => {
      expect(addCompetitionDays("2026-11-05", -1)).toBe("2026-11-04");
    });

    it("allows only today and yesterday for participant logging", () => {
      expect(isTodayOrYesterday("2026-11-05", "2026-11-05")).toBe(true);
      expect(isTodayOrYesterday("2026-11-04", "2026-11-05")).toBe(true);
      expect(isTodayOrYesterday("2026-11-03", "2026-11-05")).toBe(false);
      expect(isTodayOrYesterday("2026-11-06", "2026-11-05")).toBe(false);
    });

    it("finds challenges already completed in the current competition week", () => {
      const entries = [
        { challenge_id: "mass", competition_day: "2026-11-02" },
        { challenge_id: "rosary", competition_day: "2026-11-08" },
        { challenge_id: "mass", competition_day: "2026-11-09" },
      ];
      expect(getChallengeIdsCompletedInCompetitionWeek(entries, "2026-11-02"))
        .toEqual(["mass", "rosary"]);
      expect(getChallengeIdsCompletedInCompetitionWeek(entries, "2026-11-09"))
        .toEqual(["mass"]);
    });
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
