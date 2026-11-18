import type { CalendarEvent } from "@/lib/types";
import { FIRST_HOUR, addDays, freeHours, hourIn, hourLabel, todayIn } from "@/lib/plan";

/** What match_availability returns after the event names have been dropped. */
export type AvailabilitySnapshot = {
  youConnected: boolean;
  themConnected: boolean;
  you: CalendarEvent[];
  them: CalendarEvent[];
};

export type FreeWindow = { start: number; end: number };

export type DayCompare = {
  date: string;
  /** "Thu, Nov 19" */
  label: string;
  /** "Thu" */
  short: string;
  /** Hours you are free, including ones you share. */
  you: FreeWindow[];
  /** Hours they are free, including ones you share. */
  them: FreeWindow[];
  both: FreeWindow[];
};

const DAY_COUNT = 7;

/** The next 7 days, with the hours each person is free and the hours you share. */
export function compareCalendars(snapshot: AvailabilitySnapshot, now = new Date()): DayCompare[] {
  const today = todayIn(now);
  const days: DayCompare[] = [];

  for (let offset = 0; offset < DAY_COUNT; offset += 1) {
    const date = addDays(today, offset);
    const notBefore = offset === 0 ? Math.max(FIRST_HOUR, hourIn(now) + 1) : FIRST_HOUR;
    const you = snapshot.youConnected
      ? freeHours(snapshot.you, date).filter((hour) => hour >= notBefore)
      : [];
    const them = snapshot.themConnected
      ? freeHours(snapshot.them, date).filter((hour) => hour >= notBefore)
      : [];
    const theirs = new Set(them);

    days.push({
      date,
      label: dayLabel(date),
      short: weekdayShort(date),
      you: windows(you),
      them: windows(them),
      both: windows(you.filter((hour) => theirs.has(hour))),
    });
  }

  return days;
}

/** "Thu 12 PM–2 PM, Fri 6 PM–8 PM", capped so a match card stays one line. */
export function sharedFreeLine(days: DayCompare[], max = 3): string {
  const bits: string[] = [];
  for (const day of days) {
    for (const window of day.both) {
      bits.push(`${day.short} ${rangeLabel(window)}`);
      if (bits.length >= max) return `Both free ${bits.join(", ")}`;
    }
  }
  return bits.length > 0 ? `Both free ${bits.join(", ")}` : "";
}

export function rangeLabel(window: FreeWindow): string {
  return `${hourLabel(window.start)}–${hourLabel(window.end)}`;
}

export function formatWindows(list: FreeWindow[]): string {
  return list.map(rangeLabel).join(", ");
}

function windows(hours: number[]): FreeWindow[] {
  const list: FreeWindow[] = [];
  for (const hour of hours) {
    const last = list[list.length - 1];
    if (last && last.end === hour) last.end = hour + 1;
    else list.push({ start: hour, end: hour + 1 });
  }
  return list;
}

function dayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function weekdayShort(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
