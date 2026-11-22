const MAX_POINTS = 2_147_483_647;

export function calculateChapterPoints(
  chaptersRead: number,
  pointsPerChapter: number,
): number | null {
  if (
    !Number.isSafeInteger(chaptersRead) ||
    chaptersRead <= 0 ||
    !Number.isSafeInteger(pointsPerChapter) ||
    pointsPerChapter <= 0
  ) {
    return null;
  }

  const points = chaptersRead * pointsPerChapter;
  return Number.isSafeInteger(points) && points <= MAX_POINTS ? points : null;
}
