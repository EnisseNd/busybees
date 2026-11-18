import type { CalendarEvent, MatchPlan, MatchType } from "@/lib/types";

/**
 * Free time and the suggested meetup. Everything here is plain date math on
 * New Haven calendar days, so it runs the same in the match job, on the
 * calendar page, and in the check script.
 */

const TIME_ZONE = "America/New_York";

/** Meetups are only suggested between 9 AM and 10 PM. */
export const FIRST_HOUR = 9;
export const LAST_HOUR = 21;

// Friend meetups are always a dining hall meal: lunch first, dinner if lunch never lines up.
const FRIEND_HOURS = [12, 13, 11, 18, 17, 19];
const STUDY_HOURS = [19, 20, 15, 16, 14, 10, 11, 13, 21];

/** Yale Hospitality lists this cafe in the Schwarzman Center's lower level. */
const STUDY_PLACE = "Bass Library";

export type PlanInput = {
  /** Null or undefined means that person has not imported a calendar. */
  aEvents: CalendarEvent[] | null | undefined;
  bEvents: CalendarEvent[] | null | undefined;
  aCollege?: string | null;
  bCollege?: string | null;
  matchType: MatchType;
  /** Monday of the match week, YYYY-MM-DD. */
  weekStart: string;
  now?: Date;
};

/** Hours (9 through 21) that start and end with nothing on the calendar. */
export function freeHours(events: CalendarEvent[], date: string): number[] {
  const busy = events.filter((event) => event.date === date);
  const hours: number[] = [];
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) {
    const from = hour * 60;
    const to = from + 60;
    if (!busy.some((event) => event.start < to && event.end > from)) hours.push(hour);
  }
  return hours;
}

/** Free hours joined into stretches. `end` is the hour the stretch stops at. */
export function freeWindows(
  events: CalendarEvent[],
  date: string,
  notBefore = FIRST_HOUR,
): { start: number; end: number }[] {
  const windows: { start: number; end: number }[] = [];
  for (const hour of freeHours(events, date)) {
    if (hour < notBefore) continue;
    const last = windows[windows.length - 1];
    if (last && last.end === hour) last.end = hour + 1;
    else windows.push({ start: hour, end: hour + 1 });
  }
  return windows;
}

/**
 * The first day, from tomorrow through the Sunday that ends the match week,
 * on which both people have the same hour free.
 */
export function suggestPlan(input: PlanInput): MatchPlan | null {
  const { aEvents, bEvents, matchType, weekStart } = input;
  if (!aEvents || !bEvents) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null;

  const tomorrow = addDays(todayIn(input.now ?? new Date()), 1);
  const lastDay = addDays(weekStart, 6);
  const preferred = matchType === "study" ? STUDY_HOURS : FRIEND_HOURS;

  for (let date = tomorrow > weekStart ? tomorrow : weekStart; date <= lastDay; date = addDays(date, 1)) {
    const mine = new Set(freeHours(aEvents, date));
    const theirs = new Set(freeHours(bEvents, date));
    const hour = preferred.find((candidate) => mine.has(candidate) && theirs.has(candidate));
    if (hour === undefined) continue;
    return { date, hour, ...whereToMeet(matchType, date, hour, input.aCollege, input.bCollege) };
  }

  return null;
}

function whereToMeet(
  matchType: MatchType,
  date: string,
  hour: number,
  aCollege?: string | null,
  bCollege?: string | null,
): Pick<MatchPlan, "activity" | "place"> {
  if (matchType === "study") return { activity: "Study session", place: STUDY_PLACE };

  // Take turns hosting: even dates in the first person's college, odd in the second's.
  const meal = hour < 15 ? "Lunch" : "Dinner";
  const evenDate = Number(date.slice(8)) % 2 === 0;
  const college = (evenDate ? aCollege : bCollege) || aCollege || bCollege;
  return { activity: meal, place: college ? `${college} dining hall` : "a dining hall" };
}

/** Accepts whatever came back from the jsonb column and keeps only well-formed blocks. */
export function normalizeEvents(value: unknown): CalendarEvent[] {
  if (!Array.isArray(value)) return [];
  const events: CalendarEvent[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { date, start, end, title } = item as Record<string, unknown>;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (typeof start !== "number" || typeof end !== "number") continue;
    if (!(start >= 0 && end <= 24 * 60 && end > start)) continue;
    events.push({ date, start, end, title: typeof title === "string" ? title : "Busy" });
  }
  return events;
}

/** A sanitized plan from the jsonb column, or null. */
export function normalizePlan(value: unknown): MatchPlan | null {
  if (!value || typeof value !== "object") return null;
  const { date, hour, activity, place } = value as Record<string, unknown>;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (typeof hour !== "number" || hour < 0 || hour > 23) return null;
  if (typeof activity !== "string" || typeof place !== "string") return null;
  return { date, hour, activity, place };
}

// ---------- small date helpers on YYYY-MM-DD strings ----------

export function todayIn(now: Date): string {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The current hour in New Haven, 0 to 23. */
export function hourIn(now: Date): number {
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(text) % 24;
}

export function addDays(date: string, count: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + count));
  return next.toISOString().slice(0, 10);
}

/** 0 is Sunday. */
export function weekdayOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** "9 AM", "12 PM", "10 PM". Hour 24 reads as midnight. */
export function hourLabel(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  if (wrapped === 0) return hour === 24 ? "midnight" : "12 AM";
  if (wrapped === 12) return "12 PM";
  return wrapped > 12 ? `${wrapped - 12} PM` : `${wrapped} AM`;
}

/** "9:25 AM" from minutes after midnight. */
export function minuteLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? `${shown} ${suffix}` : `${shown}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** How long a suggested meal runs. Short enough to fit between classes. */
export const MEETUP_MINUTES = 30;

/**
 * A link that opens Google Calendar with the meetup already filled in, so
 * adding it is one tap. Times are New Haven wall-clock times.
 */
export function googleCalendarLink(plan: MatchPlan, title: string): string {
  const day = plan.date.replace(/-/g, "");
  const pad = (value: number) => String(value).padStart(2, "0");
  const start = `${day}T${pad(plan.hour)}0000`;
  const end = `${day}T${pad(plan.hour)}${pad(MEETUP_MINUTES)}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    ctz: "America/New_York",
    location: plan.place,
    details: "Set up on BusyBees.",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
