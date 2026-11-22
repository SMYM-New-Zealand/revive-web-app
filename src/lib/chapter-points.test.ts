import { describe, expect, it } from "vitest";
import { calculateChapterPoints } from "./chapter-points";

describe("calculateChapterPoints", () => {
  it("awards the configured points for each chapter", () => {
    expect(calculateChapterPoints(4, 5)).toBe(20);
  });

  it("rejects invalid counts and totals that exceed the database integer range", () => {
    expect(calculateChapterPoints(0, 5)).toBeNull();
    expect(calculateChapterPoints(1.5, 5)).toBeNull();
    expect(calculateChapterPoints(429_496_730, 5)).toBeNull();
  });
});
