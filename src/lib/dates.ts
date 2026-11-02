export function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) {
    throw new Error(`Could not determine date in timezone ${timeZone}`);
  }
  return `${year}-${month}-${day}`;
}

export function formatCompetitionDate(date: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function isAvailableOnDate(
  startsOn: string | null,
  endsOn: string | null,
  date: string,
): boolean {
  return (!startsOn || date >= startsOn) && (!endsOn || date <= endsOn);
}
