export const LEADERBOARD_PAGE_SIZE = 10;

export function paginateItems<T>(
  items: T[],
  requestedPage: number,
  pageSize = LEADERBOARD_PAGE_SIZE,
): {
  items: T[];
  page: number;
  pageCount: number;
  startIndex: number;
} {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const startIndex = (page - 1) * pageSize;
  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page,
    pageCount,
    startIndex,
  };
}
