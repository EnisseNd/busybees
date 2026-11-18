import type { CalendarEvent } from "@/lib/types";

/**
 * Reads an iCalendar (.ics) file and returns busy blocks in New Haven time.
 *
 * Covers what Google Calendar exports for a student schedule: one-off events,
 * daily and weekly repeats (classes, section, rehearsal), cancelled dates, and
 * events written in another time zone. Monthly and yearly repeats are handled
 * in their plain form (same day of the month, same date each year).
 */

export const CALENDAR_TIME_ZONE = "America/New_York";
export const MAX_EVENTS = 1500;

const DAY_MS = 86_400_000;
const MAX_TITLE = 60;
const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/** Property names the parser reads. Everything else can be dropped before upload. */
const KEPT_PROPERTIES = new Set([
  "BEGIN",
  "END",
  "UID",
  "DTSTART",
  "DTEND",
  "DURATION",
  "RRULE",
  "EXDATE",
  "RECURRENCE-ID",
  "SUMMARY",
  "STATUS",
  "TRANSP",
]);

type Wall = { y: number; m: number; d: number; h: number; mi: number };
type YMD = { y: number; m: number; d: number };

type Property = { name: string; params: Record<string, string>; value: string };

type Stamp = {
  allDay: boolean;
  zone: string;
  wall: Wall;
  utc: number;
};

type Rule = {
  freq: string;
  interval: number;
  count: number | null;
  until: number | null;
  byDay: number[];
  byMonthDay: number[];
};

type RawEvent = {
  uid: string;
  summary: string;
  status: string;
  transp: string;
  start: Property | null;
  end: Property | null;
  duration: string;
  rrule: string;
  exdates: Property[];
  recurrenceId: Property | null;
};

export type ParseOptions = {
  now?: Date;
  /** How many days ahead to keep, counting from today. */
  days?: number;
};

export function parseIcs(text: string, options: ParseOptions = {}): CalendarEvent[] {
  const now = options.now ?? new Date();
  const days = options.days ?? 60;

  const today = partsIn(now.getTime(), CALENDAR_TIME_ZONE);
  const windowStart = wallToUtc({ ...today, h: 0, mi: 0 }, CALENDAR_TIME_ZONE);
  const lastDay = addDays(today, days);
  const windowEnd = wallToUtc({ ...addDays(lastDay, 1), h: 0, mi: 0 }, CALENDAR_TIME_ZONE);

  const raw = readEvents(text);

  // A changed single occurrence of a repeating event arrives as its own VEVENT
  // with a RECURRENCE-ID. The original occurrence must not also be counted.
  const overridden = new Map<string, Set<number>>();
  for (const event of raw) {
    if (!event.recurrenceId || !event.uid) continue;
    const stamp = readStamp(event.recurrenceId);
    if (!stamp) continue;
    const set = overridden.get(event.uid) ?? new Set<number>();
    set.add(stamp.utc);
    overridden.set(event.uid, set);
  }

  const blocks: CalendarEvent[] = [];
  const seen = new Set<string>();

  for (const event of raw) {
    if (event.status.toUpperCase() === "CANCELLED") continue;
    if (event.transp.toUpperCase() === "TRANSPARENT") continue;
    if (!event.start) continue;

    const start = readStamp(event.start);
    if (!start || start.allDay) continue;

    const length = eventLength(event, start);
    const title = cleanTitle(event.summary);
    const skip = event.recurrenceId ? undefined : overridden.get(event.uid);

    for (const occurrence of occurrences(event, start, windowStart - length, windowEnd)) {
      if (skip?.has(occurrence)) continue;
      const end = occurrence + length;
      if (end <= windowStart || occurrence >= windowEnd) continue;

      for (const block of splitByDay(Math.max(occurrence, windowStart), Math.min(end, windowEnd))) {
        const key = `${block.date}|${block.start}|${block.end}|${title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        blocks.push({ ...block, title });
      }
    }
  }

  blocks.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start || a.end - b.end);
  return blocks.slice(0, MAX_EVENTS);
}

/**
 * Drops every line the parser does not read (descriptions, guests, alarms).
 * Exports are mostly description text, so this shrinks them a lot before upload.
 */
export function slimIcs(text: string): string {
  const kept: string[] = [];
  let alarmDepth = 0;

  for (const line of unfold(text)) {
    const name = propertyName(line);
    if (name === "BEGIN" && /^BEGIN:VALARM/i.test(line)) {
      alarmDepth += 1;
      continue;
    }
    if (name === "END" && /^END:VALARM/i.test(line)) {
      alarmDepth = Math.max(0, alarmDepth - 1);
      continue;
    }
    if (alarmDepth > 0) continue;
    if (KEPT_PROPERTIES.has(name)) kept.push(line);
  }

  return kept.join("\r\n");
}

export function looksLikeIcs(text: string): boolean {
  return /BEGIN:VCALENDAR/i.test(text);
}

// ---------- reading the file ----------

function unfold(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .filter((line) => line.length > 0);
}

function propertyName(line: string): string {
  const match = /^[A-Za-z0-9-]+/.exec(line);
  return match ? match[0].toUpperCase() : "";
}

function readProperty(line: string): Property | null {
  // The value starts at the first colon that is not inside a quoted parameter.
  let quoted = false;
  let split = -1;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    else if (char === ":" && !quoted) {
      split = index;
      break;
    }
  }
  if (split === -1) return null;

  const head = line.slice(0, split);
  const value = line.slice(split + 1);
  const pieces = head.split(";");
  const name = (pieces.shift() ?? "").toUpperCase();
  const params: Record<string, string> = {};
  for (const piece of pieces) {
    const eq = piece.indexOf("=");
    if (eq === -1) continue;
    params[piece.slice(0, eq).toUpperCase()] = piece.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name, params, value };
}

function readEvents(text: string): RawEvent[] {
  const events: RawEvent[] = [];
  let current: RawEvent | null = null;
  let nested = 0;

  for (const line of unfold(text)) {
    const property = readProperty(line);
    if (!property) continue;

    if (property.name === "BEGIN") {
      if (property.value.toUpperCase() === "VEVENT" && !current) {
        current = {
          uid: "",
          summary: "",
          status: "",
          transp: "",
          start: null,
          end: null,
          duration: "",
          rrule: "",
          exdates: [],
          recurrenceId: null,
        };
      } else if (current) {
        nested += 1;
      }
      continue;
    }

    if (property.name === "END") {
      if (current && nested > 0) nested -= 1;
      else if (current && property.value.toUpperCase() === "VEVENT") {
        events.push(current);
        current = null;
      }
      continue;
    }

    if (!current || nested > 0) continue;

    switch (property.name) {
      case "UID":
        current.uid = property.value;
        break;
      case "SUMMARY":
        current.summary = property.value;
        break;
      case "STATUS":
        current.status = property.value.trim();
        break;
      case "TRANSP":
        current.transp = property.value.trim();
        break;
      case "DTSTART":
        current.start = property;
        break;
      case "DTEND":
        current.end = property;
        break;
      case "DURATION":
        current.duration = property.value.trim();
        break;
      case "RRULE":
        current.rrule = property.value.trim();
        break;
      case "EXDATE":
        current.exdates.push(property);
        break;
      case "RECURRENCE-ID":
        current.recurrenceId = property;
        break;
      default:
        break;
    }
  }

  return events;
}

function cleanTitle(summary: string): string {
  const text = summary
    .replace(/\\n/gi, " ")
    .replace(/\\([,;\\])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "Busy";
  return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1).trimEnd()}…` : text;
}

// ---------- dates and time zones ----------

function readStamp(property: Property, zoneOverride?: string): Stamp | null {
  return readStampValue(property.value.trim(), property.params, zoneOverride);
}

function readStampValue(
  value: string,
  params: Record<string, string>,
  zoneOverride?: string,
): Stamp | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value);
  if (!match) return null;

  const wall: Wall = {
    y: Number(match[1]),
    m: Number(match[2]),
    d: Number(match[3]),
    h: Number(match[4] ?? 0),
    mi: Number(match[5] ?? 0),
  };
  const allDay = params.VALUE?.toUpperCase() === "DATE" || match[4] === undefined;

  if (match[7] === "Z") {
    return { allDay, zone: "UTC", wall, utc: Date.UTC(wall.y, wall.m - 1, wall.d, wall.h, wall.mi) };
  }

  // No zone on the value means "wall clock time wherever you are". For a Yale
  // calendar that is New Haven. Unknown zone names fall back the same way.
  const zone = knownZone(params.TZID) ?? zoneOverride ?? CALENDAR_TIME_ZONE;
  return { allDay, zone, wall, utc: wallToUtc(wall, zone) };
}

const zoneCache = new Map<string, string | null>();

function knownZone(name: string | undefined): string | null {
  if (!name) return null;
  const cached = zoneCache.get(name);
  if (cached !== undefined) return cached;
  let result: string | null = null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    result = name;
  } catch {
    result = null;
  }
  zoneCache.set(name, result);
  return result;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsIn(utc: number, zone: string): Wall {
  if (zone === "UTC") {
    const date = new Date(utc);
    return {
      y: date.getUTCFullYear(),
      m: date.getUTCMonth() + 1,
      d: date.getUTCDate(),
      h: date.getUTCHours(),
      mi: date.getUTCMinutes(),
    };
  }

  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(zone, formatter);
  }

  const map: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(utc))) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  return { y: map.year, m: map.month, d: map.day, h: map.hour % 24, mi: map.minute };
}

/** The instant at which clocks in `zone` read `wall`. */
function wallToUtc(wall: Wall, zone: string): number {
  const naive = Date.UTC(wall.y, wall.m - 1, wall.d, wall.h, wall.mi);
  if (zone === "UTC") return naive;

  const offsetAt = (utc: number) => {
    const shown = partsIn(utc, zone);
    return Date.UTC(shown.y, shown.m - 1, shown.d, shown.h, shown.mi) - utc;
  };

  let utc = naive - offsetAt(naive);
  // Second pass settles times next to a daylight-saving change.
  utc = naive - offsetAt(utc);
  return utc;
}

function dayNumber(date: YMD): number {
  return Math.round(Date.UTC(date.y, date.m - 1, date.d) / DAY_MS);
}

function fromDayNumber(day: number): YMD {
  const date = new Date(day * DAY_MS);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

function addDays(date: YMD, count: number): YMD {
  return fromDayNumber(dayNumber(date) + count);
}

function weekdayOf(day: number): number {
  // Day 0 (1 Jan 1970) was a Thursday.
  return (((day + 4) % 7) + 7) % 7;
}

function isoDate(date: YMD): string {
  return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
}

// ---------- length and repeats ----------

function eventLength(event: RawEvent, start: Stamp): number {
  if (event.end) {
    const end = readStamp(event.end, start.zone);
    if (end && !end.allDay && end.utc > start.utc) return end.utc - start.utc;
  }
  const fromDuration = readDuration(event.duration);
  if (fromDuration > 0) return fromDuration;
  // No end and no duration: count it as a half-hour so it still blocks time.
  return 30 * 60_000;
}

function readDuration(value: string): number {
  const match = /^[+-]?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(value);
  if (!match) return 0;
  const [, weeks, days, hours, minutes, seconds] = match;
  return (
    Number(weeks ?? 0) * 7 * DAY_MS +
    Number(days ?? 0) * DAY_MS +
    Number(hours ?? 0) * 3_600_000 +
    Number(minutes ?? 0) * 60_000 +
    Number(seconds ?? 0) * 1000
  );
}

function readRule(value: string, start: Stamp): Rule | null {
  if (!value) return null;
  const fields: Record<string, string> = {};
  for (const piece of value.split(";")) {
    const eq = piece.indexOf("=");
    if (eq > 0) fields[piece.slice(0, eq).toUpperCase()] = piece.slice(eq + 1);
  }
  const freq = (fields.FREQ ?? "").toUpperCase();
  if (!freq) return null;

  let until: number | null = null;
  if (fields.UNTIL) {
    const stamp = readStampValue(fields.UNTIL.trim(), {}, start.zone);
    if (stamp) {
      // A date-only UNTIL includes that whole day.
      until = stamp.allDay
        ? wallToUtc({ ...addDays(stamp.wall, 1), h: 0, mi: 0 }, start.zone) - 1
        : stamp.utc;
    }
  }

  const byDay = (fields.BYDAY ?? "")
    .split(",")
    .map((code) => WEEKDAY_CODES.indexOf(code.replace(/^[+-]?\d+/, "").toUpperCase() as (typeof WEEKDAY_CODES)[number]))
    .filter((index) => index >= 0);

  const byMonthDay = (fields.BYMONTHDAY ?? "")
    .split(",")
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31);

  const count = Number(fields.COUNT);
  const interval = Number(fields.INTERVAL);

  return {
    freq,
    interval: Number.isInteger(interval) && interval > 0 ? interval : 1,
    count: Number.isInteger(count) && count > 0 ? count : null,
    until,
    byDay,
    byMonthDay,
  };
}

/** Start instants of every occurrence that could touch the window. */
function occurrences(event: RawEvent, start: Stamp, from: number, to: number): number[] {
  const rule = readRule(event.rrule, start);
  if (!rule || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(rule.freq)) {
    return [start.utc];
  }

  const excludedInstants = new Set<number>();
  const excludedDays = new Set<number>();
  for (const property of event.exdates) {
    for (const value of property.value.split(",")) {
      const stamp = readStampValue(value.trim(), property.params, start.zone);
      if (!stamp) continue;
      if (stamp.allDay) excludedDays.add(dayNumber(stamp.wall));
      else excludedInstants.add(stamp.utc);
    }
  }

  const firstDay = dayNumber(start.wall);
  const lastDay = dayNumber(partsIn(to, start.zone)) + 1;
  const weekdays = rule.byDay.length > 0 ? rule.byDay : [weekdayOf(firstDay)];
  const monthDays = rule.byMonthDay.length > 0 ? rule.byMonthDay : [start.wall.d];
  // Weeks are counted from Monday, the iCalendar default.
  const weekIndex = (day: number) => Math.floor((day + 3) / 7);

  const matches = (day: number): boolean => {
    const date = fromDayNumber(day);
    switch (rule.freq) {
      case "DAILY":
        return (day - firstDay) % rule.interval === 0;
      case "WEEKLY":
        return (
          weekdays.includes(weekdayOf(day)) &&
          (weekIndex(day) - weekIndex(firstDay)) % rule.interval === 0
        );
      case "MONTHLY": {
        const months = (date.y - start.wall.y) * 12 + (date.m - start.wall.m);
        return monthDays.includes(date.d) && months % rule.interval === 0;
      }
      default:
        return (
          date.m === start.wall.m &&
          date.d === start.wall.d &&
          (date.y - start.wall.y) % rule.interval === 0
        );
    }
  };

  // Without a COUNT there is no need to walk through years of past classes.
  let day = firstDay;
  if (rule.count === null) {
    const jump = dayNumber(partsIn(from, start.zone)) - 1;
    if (jump > day) day = jump;
  }

  const found: number[] = [];
  let produced = 0;
  let guard = 0;

  for (; day <= lastDay && guard < 40_000; day += 1, guard += 1) {
    if (!matches(day)) continue;
    produced += 1;
    if (rule.count !== null && produced > rule.count) break;

    const date = fromDayNumber(day);
    const instant = wallToUtc({ ...date, h: start.wall.h, mi: start.wall.mi }, start.zone);
    if (rule.until !== null && instant > rule.until) break;
    if (excludedInstants.has(instant) || excludedDays.has(day)) continue;
    if (instant >= to) break;
    found.push(instant);
  }

  return found;
}

/** Cuts a span into one block per New Haven calendar day. */
function splitByDay(from: number, to: number): Omit<CalendarEvent, "title">[] {
  const blocks: Omit<CalendarEvent, "title">[] = [];
  let cursor = from;
  let guard = 0;

  while (cursor < to && guard < 400) {
    guard += 1;
    const here = partsIn(cursor, CALENDAR_TIME_ZONE);
    const nextMidnight = wallToUtc({ ...addDays(here, 1), h: 0, mi: 0 }, CALENDAR_TIME_ZONE);
    const stop = Math.min(to, nextMidnight);
    const startMinutes = here.h * 60 + here.mi;
    let endMinutes = 24 * 60;
    if (stop < nextMidnight) {
      const end = partsIn(stop, CALENDAR_TIME_ZONE);
      endMinutes = end.h * 60 + end.mi;
    }
    if (endMinutes > startMinutes) {
      blocks.push({ date: isoDate(here), start: startMinutes, end: endMinutes });
    }
    cursor = stop;
  }

  return blocks;
}
