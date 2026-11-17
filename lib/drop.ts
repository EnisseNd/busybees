const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DROP_MINUTES = 9 * 60;

type NyParts = {
  weekday: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/** Matches drop Monday at 9:00am America/New_York. */
export function nextDropInfo(now = new Date()): { days: number; phrase: string } {
  const parts = nyParts(now);
  const weekdayIndex = WEEKDAYS.indexOf(parts.weekday as (typeof WEEKDAYS)[number]);
  const safeIndex = weekdayIndex === -1 ? 0 : weekdayIndex;
  let days = (1 - safeIndex + 7) % 7;

  if (safeIndex === 1) {
    const minutes = parts.hour * 60 + parts.minute;
    days = minutes < DROP_MINUTES ? 0 : 7;
  }

  const phrase =
    days === 0
      ? "Next matches drop today"
      : days === 1
        ? "Next matches drop in 1 day"
        : `Next matches drop in ${days} days`;

  return { days, phrase };
}

/** Monday of the current New York week, as YYYY-MM-DD. */
export function weekStartISO(now = new Date()): string {
  const parts = nyParts(now);
  const weekdayIndex = WEEKDAYS.indexOf(parts.weekday as (typeof WEEKDAYS)[number]);
  const safeIndex = weekdayIndex === -1 ? 1 : weekdayIndex;
  const daysSinceMonday = safeIndex === 0 ? 6 : safeIndex - 1;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export function formatWeek(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function nyParts(now: Date): NyParts {
  const map: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    weekday: map.weekday ?? "Mon",
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}
