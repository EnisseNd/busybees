import type { CalendarEvent, MatchCardModel, TrayItem } from "@/lib/types";

/**
 * Sample people for /demo, so the whole flow can be shown without accounts or
 * a database. None of them are real students.
 */

const pad = (value: number) => String(value).padStart(2, "0");

export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shift(today: Date, days: number): Date {
  const next = new Date(today);
  next.setDate(next.getDate() + days);
  return next;
}

/** The next date that falls on `weekday` (0 = Sunday), never today. */
function upcoming(today: Date, weekday: number): string {
  const ahead = ((weekday - today.getDay() + 7) % 7) || 7;
  return isoDay(shift(today, ahead));
}

function mondayOf(today: Date): string {
  return isoDay(shift(today, -((today.getDay() + 6) % 7)));
}

const cutout = (name: string) => `/collage/${name}.webp`;

export const DEMO_MY_TRAY: TrayItem[] = [
  { label: "Sunflowers", emoji: "🌻", image: cutout("thing-sunflowers") },
  { label: "Romcoms", emoji: "🎬", image: cutout("thing-clapper") },
  { label: "East Rock", emoji: "👟", image: cutout("thing-sneakers") },
  { label: "Matcha", emoji: "🍵", image: cutout("drink-matcha") },
  { label: "Thrifting", emoji: "🧣", image: cutout("thing-scarf"), extras: [cutout("thing-skirt")] },
];

export function demoMatches(today: Date): MatchCardModel[] {
  const weekStart = mondayOf(today);
  const lastWeek = isoDay(shift(new Date(`${weekStart}T12:00:00`), -7));
  const pending = { status: "pending", viewerResponse: "pending", partnerResponse: "interested" } as const;

  return [
    {
      id: "mateo", matchType: "friend", weekStart, score: 82, ...pending,
      whyMatched: "You both put a thrift find and a long walk on your tray, and you both want someone to explore New Haven with.",
      plan: { date: upcoming(today, 4), hour: 12, activity: "Lunch", place: "Saybrook dining hall" },
      partner: {
        id: "p-mateo", firstName: "Mateo", college: "Pierson", classYear: 2029,
        tray: [
          { label: "Lilies", emoji: "🌷", image: cutout("thing-lily") },
          { label: "Old movies", emoji: "🎬", image: cutout("thing-clapper") },
          { label: "Long walks", emoji: "👟", image: cutout("thing-sneakers") },
          { label: "Iced coffee", emoji: "☕", image: cutout("drink-coffee") },
          { label: "Flea markets", emoji: "🧣", image: cutout("thing-scarf") },
        ],
      },
    },
    {
      id: "priya", matchType: "friend", weekStart, score: 74, ...pending,
      whyMatched: "Matcha is on both your trays, and you both said you want a meal buddy.",
      plan: { date: upcoming(today, 3), hour: 13, activity: "Lunch", place: "Branford dining hall" },
      partner: {
        id: "p-priya", firstName: "Priya", college: "Branford", classYear: 2028,
        tray: [
          { label: "Sunflowers", emoji: "🌻", image: cutout("thing-sunflowers") },
          { label: "Carillon bells", emoji: "🔔" },
          { label: "Novels", emoji: "📖" },
          { label: "Matcha", emoji: "🍵", image: cutout("drink-matcha") },
          { label: "Tulle skirts", emoji: "👗", image: cutout("thing-skirt") },
        ],
      },
    },
    {
      id: "jonah", matchType: "friend", weekStart, score: 61, ...pending,
      whyMatched: "You both picked movie nights, and you're both free at the same lunch hour twice this week.",
      plan: { date: upcoming(today, 5), hour: 12, activity: "Lunch", place: "Silliman dining hall" },
      partner: {
        id: "p-jonah", firstName: "Jonah", college: "Silliman", classYear: 2030,
        tray: [
          { label: "Cactus", emoji: "🌵" },
          { label: "Movie nights", emoji: "🎬", image: cutout("thing-clapper") },
          { label: "IM volleyball", emoji: "🏐" },
          { label: "Tea", emoji: "🍵", image: cutout("drink-tea") },
          { label: "Board games", emoji: "🎲" },
        ],
      },
    },
    {
      id: "noor", matchType: "study", weekStart, score: 70, ...pending,
      whyMatched: "You both listed Economics, you both like timed sprints, and you're both free weekday evenings.",
      plan: { date: upcoming(today, 1), hour: 19, activity: "Study session", place: "Bass Library" },
      partner: {
        id: "p-noor", firstName: "Noor", college: "Benjamin Franklin", classYear: 2030,
        tray: [
          { label: "Flashcards", emoji: "🗂️" },
          { label: "Puzzles", emoji: "🧩" },
          { label: "Star charts", emoji: "🌌" },
          { label: "Tea", emoji: "🍵", image: cutout("drink-tea") },
          { label: "Sourdough", emoji: "🍞" },
        ],
      },
    },
    {
      id: "hannah", matchType: "friend", weekStart: lastWeek, score: 77,
      status: "mutual", viewerResponse: "interested", partnerResponse: "interested",
      whyMatched: "You both put romcoms on your tray.",
      plan: { date: isoDay(shift(today, -5)), hour: 12, activity: "Lunch", place: "Jonathan Edwards dining hall" },
      partner: {
        id: "p-hannah", firstName: "Hannah", college: "Jonathan Edwards", classYear: 2028,
        tray: [
          { label: "Lilies", emoji: "🌷", image: cutout("thing-lily") },
          { label: "Romcoms", emoji: "🎬", image: cutout("thing-clapper") },
          { label: "Tarot", emoji: "🃏" },
          { label: "Iced coffee", emoji: "☕", image: cutout("drink-coffee") },
          { label: "Cookies", emoji: "🍪" },
        ],
      },
    },
  ];
}

/** A plausible class schedule as busy blocks only, five weeks around today. */
export function demoBusy(today: Date): CalendarEvent[] {
  const blocks: CalendarEvent[] = [];
  const add = (date: Date, start: number, end: number) =>
    blocks.push({ date: isoDay(date), start, end, title: "" });

  for (let offset = -7; offset <= 35; offset += 1) {
    const day = shift(today, offset);
    const weekday = day.getDay();
    if (weekday === 1 || weekday === 3) {
      add(day, 9 * 60 + 25, 10 * 60 + 40);
      add(day, 14 * 60 + 30, 15 * 60 + 45);
    }
    if (weekday === 2 || weekday === 4) {
      add(day, 9 * 60, 10 * 60 + 15);
      add(day, 13 * 60, 14 * 60 + 15);
      add(day, 16 * 60, 18 * 60);
    }
    if (weekday === 5) add(day, 10 * 60, 11 * 60);
  }
  // One day with no gap at all, so the patterned "booked solid" cell shows up.
  const packed = shift(today, ((2 - today.getDay() + 7) % 7) + 7);
  add(packed, 10 * 60 + 15, 13 * 60);
  add(packed, 14 * 60 + 15, 16 * 60);
  add(packed, 18 * 60, 20 * 60 + 30);
  return blocks;
}

const ANSWERS_KEY = "busybee-demo-answers";
const TRAY_KEY = "busybee-demo-tray";

export type DemoAnswers = Record<string, "interested" | "passed">;

/** Demo state lives in the tab only. Storage can be unavailable, so every read is guarded. */
export function readAnswers(): DemoAnswers {
  try {
    return JSON.parse(window.sessionStorage.getItem(ANSWERS_KEY) ?? "{}") as DemoAnswers;
  } catch {
    return {};
  }
}

export function writeAnswers(answers: DemoAnswers) {
  try {
    window.sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
  } catch {
    // Nothing to do: the demo still works for this page view.
  }
}

export function readTray(): { firstName: string; items: TrayItem[] } {
  try {
    const saved = window.sessionStorage.getItem(TRAY_KEY);
    if (saved) return JSON.parse(saved) as { firstName: string; items: TrayItem[] };
  } catch {
    // Fall through to the sample tray.
  }
  return { firstName: "", items: DEMO_MY_TRAY };
}

export function writeTray(tray: { firstName: string; items: TrayItem[] }) {
  try {
    window.sessionStorage.setItem(TRAY_KEY, JSON.stringify(tray));
  } catch {
    // Photos can be too big for tab storage. The editor still shows the tray.
  }
}

/** Applies the visitor's answers. Sample people always say yes back. */
export function withAnswers(matches: MatchCardModel[], answers: DemoAnswers): MatchCardModel[] {
  return matches.map((match) => {
    const answer = answers[match.id];
    if (!answer || match.viewerResponse !== "pending") return match;
    return {
      ...match,
      viewerResponse: answer,
      status: answer === "interested" ? "mutual" : "closed",
    };
  });
}
