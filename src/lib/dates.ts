export function dateInTimeZone(
  date: Date,
  timeZone: string,
  dayStartHour = 4,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  const hour = part("hour");
  if (!year || !month || !day || !hour) {
    throw new Error(`Could not determine date in timezone ${timeZone}`);
  }
  const calendarDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day) - (Number(hour) < dayStartHour ? 1 : 0)),
  );
  return calendarDate.toISOString().slice(0, 10);
}

export function addCompetitionDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day || !Number.isInteger(days)) {
    throw new Error("Invalid date or day offset.");
  }
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function isTodayOrYesterday(date: string, today: string): boolean {
  return date === today || date === addCompetitionDays(today, -1);
}

export function competitionWeekStart(
  competitionDay: string,
  competitionStart: string,
): string {
  const day = Date.parse(`${competitionDay}T00:00:00Z`);
  const start = Date.parse(`${competitionStart}T00:00:00Z`);
  if (
    Number.isNaN(day) ||
    Number.isNaN(start) ||
    competitionDay < competitionStart
  ) {
    throw new Error("Competition day must be on or after the competition start.");
  }
  const elapsedDays = Math.floor((day - start) / 86_400_000);
  return addCompetitionDays(
    competitionStart,
    Math.floor(elapsedDays / 7) * 7,
  );
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
