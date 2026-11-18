import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarImport } from "@/components/calendar-import";
import { MonthCalendar, monthName, type Meetup } from "@/components/month-calendar";
import { Scrap } from "@/components/scrap";
import { requireUser } from "@/lib/auth";
import { partnerId } from "@/lib/match-view";
import {
  FIRST_HOUR,
  addDays,
  freeWindows,
  hourIn,
  hourLabel,
  normalizeEvents,
  normalizePlan,
  todayIn,
} from "@/lib/plan";
import { cardClass } from "@/lib/styles";
import { createClient } from "@/lib/supabase/server";
import type { MatchPlan } from "@/lib/types";

export const metadata: Metadata = {
  title: "Calendar",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
      <h1 className="text-center leading-none">
        <Scrap tilt={-3}>
          <span className="font-script text-5xl ink-leaf sm:text-6xl">When are</span>
        </Scrap>{" "}
        <Scrap shape={1} tilt={2}>
          <span className="font-serif text-4xl ink-rose sm:text-5xl">you free?</span>
        </Scrap>
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-center text-base leading-7 text-ink">
        Import your Google Calendar and each match comes with a time you can both make, and
        somewhere to go.
      </p>

      <Suspense fallback={<p className="mt-8 text-center text-sm text-muted">Loading your calendar…</p>}>
        <CalendarLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

type CalendarRow = { events: unknown; updated_at: string | null };
type MatchRow = {
  id: string;
  user_id: string;
  matched_user_id: string;
  status: string;
  plan: unknown;
};
type PartnerRow = { id: string; first_name?: string | null; college: string };
type PlannedMeetup = Meetup & { plan: MatchPlan; matchId: string };

async function CalendarLoader({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const profile = await requireUser();
  await connection();

  const now = new Date();
  const today = todayIn(now);
  const thisMonth = today.slice(0, 7);
  const nextMonth = shiftMonth(thisMonth, 1);
  const month = params.m === nextMonth ? nextMonth : thisMonth;

  const supabase = await createClient();
  const { data: calendarData, error: calendarError } = await supabase
    .from("calendars")
    .select("events, updated_at")
    .eq("user_id", profile.id)
    .maybeSingle();

  // An error here means the calendars table has not been created yet.
  const setupMissing = Boolean(calendarError);
  const row = (calendarError ? null : calendarData) as CalendarRow | null;
  const hasCalendar = Boolean(row);
  const events = normalizeEvents(row?.events);
  const meetups = await loadMeetups(profile.id, today);

  const week = Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(today, offset);
    const windows = freeWindows(events, date, offset === 0 ? Math.max(FIRST_HOUR, hourIn(now) + 1) : FIRST_HOUR);
    return { date, label: offset === 0 ? "Today" : dayLabel(date), windows };
  });

  return (
    <>
      <div className={`${cardClass} mt-8`}>
        <CalendarImport
          eventCount={events.length}
          hasCalendar={hasCalendar}
          importedOn={row?.updated_at ? shortDate(row.updated_at) : ""}
          setupMissing={setupMissing}
        />
      </div>

      <div className="calendar-frame mt-8">
        <MonthCalendar
          events={events}
          hasCalendar={hasCalendar}
          meetups={meetups}
          month={month}
          otherMonth={
            month === thisMonth
              ? { href: `/calendar?m=${nextMonth}`, label: `See ${monthName(nextMonth)}` }
              : { href: "/calendar", label: `Back to ${monthName(thisMonth)}` }
          }
          today={today}
        />
      </div>

      {meetups.length > 0 ? (
        <section className={`${cardClass} mt-8`}>
          <h2 className="font-serif text-2xl text-ink">Suggested meetups</h2>
          <ul className="cal-free mt-3 text-sm leading-6 text-ink">
            {meetups.map((meetup) => (
              <li key={meetup.matchId}>
                <span className="font-extrabold">{dayLabel(meetup.date)}</span>
                <span>
                  {meetup.label} at {meetup.plan.place}, {hourLabel(meetup.hour)}.{" "}
                  <Link className="font-bold text-leaf underline" href="/matches">
                    See the match
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={`${cardClass} mt-8`}>
        <h2 className="font-serif text-2xl text-ink">Free this week</h2>
        {hasCalendar ? (
          <ul className="cal-free mt-3 text-sm leading-6 text-ink">
            {week.map((day) => (
              <li key={day.date}>
                <span className="font-extrabold">{day.label}</span>
                <span className={day.windows.length === 0 ? "text-muted" : ""}>
                  {describeWindows(day.windows)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">
            Nothing imported yet, so we can&rsquo;t tell when you&rsquo;re free. Matches still
            arrive, just without a suggested time.
          </p>
        )}
      </section>
    </>
  );
}

/**
 * Suggested meetups on the viewer's open matches. The plan column and first
 * names come from a later migration, so every query here falls back quietly.
 */
async function loadMeetups(viewerId: string, today: string): Promise<PlannedMeetup[]> {
  const supabase = await createClient();
  const columns = "id, user_id, matched_user_id, status, plan";
  const [asUser, asMatch] = await Promise.all([
    supabase.from("matches").select(columns).eq("user_id", viewerId).neq("status", "closed"),
    supabase.from("matches").select(columns).eq("matched_user_id", viewerId).neq("status", "closed"),
  ]);
  if (asUser.error || asMatch.error) return [];

  const planned: { row: MatchRow; plan: MatchPlan }[] = [];
  const seen = new Set<string>();
  for (const row of [...(asUser.data ?? []), ...(asMatch.data ?? [])] as MatchRow[]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const plan = normalizePlan(row.plan);
    if (plan && plan.date >= today) planned.push({ row, plan });
  }
  if (planned.length === 0) return [];

  const partnerIds = Array.from(new Set(planned.map(({ row }) => partnerId(row, viewerId))));
  const partners = new Map<string, PartnerRow>();
  const named = await supabase.from("users").select("id, first_name, college").in("id", partnerIds);
  const rows = named.error
    ? (await supabase.from("users").select("id, college").in("id", partnerIds)).data
    : named.data;
  for (const partner of (rows ?? []) as PartnerRow[]) partners.set(partner.id, partner);

  return planned
    .map(({ row, plan }) => {
      const partner = partners.get(partnerId(row, viewerId));
      const who = partner?.first_name?.trim() || (partner?.college ? `someone in ${partner.college}` : "your match");
      return {
        matchId: row.id,
        date: plan.date,
        hour: plan.hour,
        label: `${plan.activity} with ${who}`,
        plan,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
}

function shiftMonth(month: string, by: number): string {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}

/** "Wed, Nov 18" */
function dayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** "Nov 17" in New Haven time. */
function shortDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

function describeWindows(windows: { start: number; end: number }[]): string {
  if (windows.length === 0) return "Booked";
  if (windows.length === 1 && windows[0].start === FIRST_HOUR && windows[0].end === 22) {
    return "Open all day";
  }
  return windows.map((window) => `${hourLabel(window.start)} to ${hourLabel(window.end)}`).join(", ");
}

