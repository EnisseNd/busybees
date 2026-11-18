const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DROP_WEEKDAY = 0; // Sunday
const DROP_MINUTES = 20 * 60;

type NyParts = {
  weekday: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/** Matches drop Sunday at 8:00pm America/New_York. */
export function nextDropInfo(now = new Date()): { days: number; phrase: string } {
  const parts = nyParts(now);
  const weekdayIndex = WEEKDAYS.indexOf(parts.weekday as (typeof WEEKDAYS)[number]);
  const safeIndex = weekdayIndex === -1 ? 0 : weekdayIndex;
  let days = (DROP_WEEKDAY - safeIndex + 7) % 7;

  if (safeIndex === DROP_WEEKDAY) {
    const minutes = parts.hour * 60 + parts.minute;
    days = minutes < DROP_MINUTES ? 0 : 7;
  }

  const phrase =
    days === 0
      ? "New trays drop tonight at 8"
      : days === 1
        ? "New trays drop tomorrow at 8pm"
        : `New trays drop in ${days} days`;

  return { days, phrase };
}

/**
 * Monday of the match week, as YYYY-MM-DD. A week belongs to the Sunday 8pm
 * drop before it, so from Sunday 8pm onward this is the Monday that follows.
 */
export function weekStartISO(now = new Date()): string {
  // Shifting four hours forward turns "Sunday 8pm or later" into Monday.
  const parts = nyParts(new Date(now.getTime() + 4 * 60 * 60 * 1000));
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
