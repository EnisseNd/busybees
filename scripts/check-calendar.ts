import { parseIcs, slimIcs } from "../lib/ics";
import { freeHours, freeWindows, normalizeEvents, suggestPlan } from "../lib/plan";
import type { CalendarEvent } from "../lib/types";

// Run with: npx tsx scripts/check-calendar.ts

const failures: string[] = [];

function check(name: string, condition: boolean) {
  if (!condition) failures.push(`FAIL ${name}`);
}

// Tuesday 17 Nov 2026, 6:40 PM in New Haven.
const now = new Date("2026-11-17T23:40:00Z");

const ics = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  // A Monday/Wednesday class that started in September (daylight time) and ends 4 Dec.
  "BEGIN:VEVENT",
  "UID:class@example",
  "DTSTART;TZID=America/New_York:20260902T092500",
  "DTEND;TZID=America/New_York:20260902T104000",
  "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261204T235959Z",
  "EXDATE;TZID=America/New_York:20261123T092500",
  "SUMMARY:ECON 2159 lecture",
  "DESCRIPTION:Room 101\\, bring the problem set",
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "TRIGGER:-PT10M",
  "END:VALARM",
  "END:VEVENT",
  // Written in UTC: 5 PM UTC is noon in New Haven in November.
  "BEGIN:VEVENT",
  "UID:utc@example",
  "DTSTART:20261119T170000Z",
  "DTEND:20261119T180000Z",
  "SUMMARY:Lab meeting with a very long",
  "  name that wraps onto a second line",
  "END:VEVENT",
  // All-day events do not block time.
  "BEGIN:VEVENT",
  "UID:allday@example",
  "DTSTART;VALUE=DATE:20261120",
  "DTEND;VALUE=DATE:20261121",
  "SUMMARY:Family weekend",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:cancelled@example",
  "DTSTART;TZID=America/New_York:20261120T140000",
  "DTEND;TZID=America/New_York:20261120T150000",
  "STATUS:CANCELLED",
  "SUMMARY:Office hours",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:free@example",
  "DTSTART;TZID=America/New_York:20261120T160000",
  "DTEND;TZID=America/New_York:20261120T170000",
  "TRANSP:TRANSPARENT",
  "SUMMARY:Optional talk",
  "END:VEVENT",
  // 10 PM Saturday to 1:30 AM Sunday.
  "BEGIN:VEVENT",
  "UID:late@example",
  "DTSTART;TZID=America/New_York:20261121T220000",
  "DTEND;TZID=America/New_York:20261122T013000",
  "SUMMARY:Formal",
  "END:VEVENT",
  // 9 AM in Los Angeles is noon in New Haven.
  "BEGIN:VEVENT",
  "UID:west@example",
  "DTSTART;TZID=America/Los_Angeles:20261124T090000",
  "DURATION:PT45M",
  "SUMMARY:Call home",
  "END:VEVENT",
  // Three mornings starting the day before today.
  "BEGIN:VEVENT",
  "UID:count@example",
  "DTSTART;TZID=America/New_York:20261116T080000",
  "DTEND;TZID=America/New_York:20261116T090000",
  "RRULE:FREQ=DAILY;COUNT=3",
  "SUMMARY:Rowing",
  "END:VEVENT",
  // Every other Tuesday, starting 10 Nov.
  "BEGIN:VEVENT",
  "UID:biweekly@example",
  "DTSTART;TZID=America/New_York:20261110T160000",
  "DTEND;TZID=America/New_York:20261110T170000",
  "RRULE:FREQ=WEEKLY;INTERVAL=2",
  "SUMMARY:Board meeting",
  "END:VEVENT",
  // One Wednesday lecture moved to the afternoon.
  "BEGIN:VEVENT",
  "UID:class@example",
  "RECURRENCE-ID;TZID=America/New_York:20261202T092500",
  "DTSTART;TZID=America/New_York:20261202T150000",
  "DTEND;TZID=America/New_York:20261202T161500",
  "SUMMARY:ECON 2159 lecture (moved)",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const events = parseIcs(ics, { now });
const on = (date: string) => events.filter((event) => event.date === date);
const titled = (title: string) => events.filter((event) => event.title.startsWith(title));
const lectures = titled("ECON 2159 lecture").filter((event) => !event.title.includes("moved"));

check("weekly class lands on Wednesday 18 Nov at 9:25", on("2026-11-18").some((e) => e.start === 565 && e.end === 640));
check("class keeps its wall-clock time across the daylight-saving change", lectures.every((e) => e.start === 565));
check("EXDATE removes Monday 23 Nov", !lectures.some((e) => e.date === "2026-11-23"));
check("class still meets Wednesday 25 Nov", lectures.some((e) => e.date === "2026-11-25"));
check("UNTIL stops the class after 4 Dec", !lectures.some((e) => e.date > "2026-12-04"));
check("class dates are the expected set", lectures.map((e) => e.date).join(",") === "2026-11-18,2026-11-25,2026-11-30");
check(
  "a moved occurrence replaces the original",
  on("2026-12-02").length === 1 && on("2026-12-02")[0].start === 900 && on("2026-12-02")[0].end === 975,
);

const lab = titled("Lab meeting");
check("UTC event is converted to New Haven time", lab.length === 1 && lab[0].date === "2026-11-19" && lab[0].start === 720 && lab[0].end === 780);
check("folded lines are joined", lab[0]?.title === "Lab meeting with a very long name that wraps onto a second line".slice(0, 59).trimEnd() + "…");
check("titles stay within 60 characters", events.every((e) => e.title.length <= 60));

check("all-day events are ignored", titled("Family weekend").length === 0);
check("cancelled events are ignored", titled("Office hours").length === 0);
check("events marked free are ignored", titled("Optional talk").length === 0);
check("nothing is left on Friday 20 Nov", on("2026-11-20").length === 0);

const formal = titled("Formal");
check(
  "an event that crosses midnight is split by day",
  formal.length === 2 &&
    formal[0].date === "2026-11-21" && formal[0].start === 1320 && formal[0].end === 1440 &&
    formal[1].date === "2026-11-22" && formal[1].start === 0 && formal[1].end === 90,
);

const call = titled("Call home");
check("another time zone plus DURATION", call.length === 1 && call[0].date === "2026-11-24" && call[0].start === 720 && call[0].end === 765);

const rowing = titled("Rowing");
check("COUNT=3 keeps only the occurrences inside the window", rowing.map((e) => e.date).join(",") === "2026-11-17,2026-11-18");

const board = titled("Board meeting");
check("INTERVAL=2 skips the off week", !board.some((e) => e.date === "2026-11-17") && board.some((e) => e.date === "2026-11-24"));
check("nothing before today", events.every((e) => e.date >= "2026-11-17"));
check("nothing past the 60-day window", events.every((e) => e.date <= "2027-01-16"));
check("events are sorted", events.every((e, i) => i === 0 || events[i - 1].date <= e.date));

const slim = slimIcs(ics);
check("slimming drops descriptions and alarms", !slim.includes("DESCRIPTION") && !slim.includes("VALARM"));
check("slimming does not change the result", JSON.stringify(parseIcs(slim, { now })) === JSON.stringify(events));
check("a non-calendar file gives no events", parseIcs("hello", { now }).length === 0);

// Wednesday 18 Nov: rowing 8-9, lecture 9:25-10:40.
const wednesday = freeHours(events, "2026-11-18");
check("freeHours skips the hours a class touches", !wednesday.includes(9) && !wednesday.includes(10));
check("freeHours covers 11 through 21 on that day", wednesday.join(",") === "11,12,13,14,15,16,17,18,19,20,21");
check("freeHours on an empty day is 9 through 21", freeHours(events, "2026-12-25").length === 13);
check("freeWindows joins hours", JSON.stringify(freeWindows(events, "2026-11-18")) === JSON.stringify([{ start: 11, end: 22 }]));

const busy = (date: string, from: number, to: number): CalendarEvent => ({ date, start: from * 60, end: to * 60, title: "Busy" });
const other = [busy("2026-11-18", 12, 14)];
const shared = { aCollege: "Saybrook", bCollege: "Pierson", weekStart: "2026-11-16", now };

const friendPlan = suggestPlan({ ...shared, aEvents: events, bEvents: other, matchType: "friend" });
check(
  "friend plan takes the first shared hour by preference",
  JSON.stringify(friendPlan) === JSON.stringify({ date: "2026-11-18", hour: 11, activity: "Lunch", place: "Saybrook dining hall" }),
);

const lunchPlan = suggestPlan({ ...shared, aEvents: events, bEvents: [], matchType: "friend" });
check("lunch wins when noon is open", lunchPlan?.hour === 12 && lunchPlan.activity === "Lunch");

const studyPlan = suggestPlan({ ...shared, aEvents: events, bEvents: other, matchType: "study" });
check("study plan is an evening at Bass", studyPlan?.hour === 19 && studyPlan.activity === "Study session" && studyPlan.place === "Bass Library");

// Wednesday fully booked for one person, Thursday open only at 3 PM and from 6 PM.
const packed = [busy("2026-11-18", 9, 22), busy("2026-11-19", 9, 15), busy("2026-11-19", 16, 18)];
const later = suggestPlan({ ...shared, aEvents: packed, bEvents: [], matchType: "friend" });
check("a free mid-afternoon hour is skipped: friend plans are always a meal", later?.date === "2026-11-19" && later.hour === 18 && later.activity === "Dinner");
check("odd dates use the second person's college for meals", suggestPlan({ ...shared, aEvents: [busy("2026-11-18", 9, 22)], bEvents: [], matchType: "friend" })?.place === "Pierson dining hall");

check("no plan unless both people have a calendar", suggestPlan({ ...shared, aEvents: events, bEvents: null, matchType: "friend" }) === null);
check("no plan when neither does", suggestPlan({ ...shared, aEvents: undefined, bEvents: undefined, matchType: "friend" }) === null);
check(
  "no plan once the week is over",
  suggestPlan({ ...shared, aEvents: [], bEvents: [], matchType: "friend", now: new Date("2026-11-22T20:00:00Z") }) === null,
);
const weekOfBusy = Array.from({ length: 7 }, (_, i) => busy(`2026-11-${String(16 + i).padStart(2, "0")}`, 9, 22));
check("no plan when there is no shared hour", suggestPlan({ ...shared, aEvents: weekOfBusy, bEvents: [], matchType: "friend" }) === null);

check("normalizeEvents drops malformed rows", normalizeEvents([{ date: "2026-11-18", start: 60, end: 120, title: "ok" }, { date: "x" }, null, 4]).length === 1);
check("normalizeEvents handles a missing column", normalizeEvents(undefined).length === 0);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`calendar ok (${events.length} busy blocks parsed)`);
