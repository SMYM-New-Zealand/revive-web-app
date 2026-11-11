import { describe, expect, it } from "vitest";
import { LEADERBOARD_PAGE_SIZE, paginateItems } from "./leaderboard";

describe("leaderboard pagination", () => {
  const rows = Array.from({ length: 23 }, (_, index) => `participant-${index + 1}`);

  it("limits each page to ten rows and calculates page bounds", () => {
    const firstPage = paginateItems(rows, 1);
    expect(firstPage.items).toHaveLength(10);
    expect(firstPage.items[0]).toBe("participant-1");
    expect(firstPage.pageCount).toBe(3);
    expect(firstPage.startIndex).toBe(0);

    const lastPage = paginateItems(rows, 3);
    expect(lastPage.items).toHaveLength(3);
    expect(lastPage.items[0]).toBe("participant-21");
    expect(lastPage.startIndex).toBe(20);
  });

  it("clamps requested pages to valid bounds", () => {
    expect(paginateItems(rows, 0).page).toBe(1);
    expect(paginateItems(rows, 99).page).toBe(3);
    expect(paginateItems([], 3).pageCount).toBe(1);
  });

  it("supports separate paging for independently filtered genders", () => {
    const maleRows = rows.slice(0, 12);
    const femaleRows = rows.slice(12);

    expect(paginateItems(maleRows, 2).items).toHaveLength(2);
    expect(paginateItems(femaleRows, 1).items).toHaveLength(10);
    expect(LEADERBOARD_PAGE_SIZE).toBe(10);
  });
});
