"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MonthCalendar, type Meetup } from "@/components/month-calendar";
import { demoBusy, demoMatches, isoDay, readAnswers, withAnswers } from "@/lib/demo-data";
import { cardClass, fieldClass, labelClass, primaryButtonClass } from "@/lib/styles";
import type { CalendarEvent } from "@/lib/types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function DemoCalendar() {
  const wanted = useSearchParams().get("m");
  const [today, setToday] = useState<Date | null>(null);
  const [imported, setImported] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [meetups, setMeetups] = useState<Meetup[]>([]);

  useEffect(() => {
    const now = new Date();
    setToday(now);
    // Lunches the visitor said yes to in the sample week show up on the calendar.
    const kept = withAnswers(demoMatches(now), readAnswers()).filter(
      (match) => match.plan && match.status === "mutual",
    );
    setMeetups(
      kept.map((match) => ({
        date: match.plan!.date,
        hour: match.plan!.hour,
        label: `${match.plan!.activity} with ${match.partner.firstName}`,
      })),
    );
  }, []);

  if (!today) return <p className="mt-6 text-sm font-semibold text-muted">Opening the calendar…</p>;

  const thisMonth = isoDay(today).slice(0, 7);
  const after = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonth = isoDay(after).slice(0, 7);
  const month = wanted === nextMonth ? nextMonth : thisMonth;
  const other =
    month === thisMonth
      ? { href: `/demo/calendar?m=${nextMonth}`, label: `See ${MONTHS[after.getMonth()]}` }
      : { href: "/demo/calendar", label: `Back to ${MONTHS[today.getMonth()]}` };

  return (
    <>
      <div className={`${cardClass} mt-8 grid gap-6 md:grid-cols-2`}>
        <div>
          <h2 className="font-serif text-2xl text-ink">Bring in your Google Calendar</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink">
            We only keep when you&rsquo;re busy. Event names, places and guests are thrown away the
            moment you import, so nobody here can see what&rsquo;s on your calendar. Your match only
            sees the lunch time we pick.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setEvents(demoBusy(today));
            setImported(true);
          }}
        >
          <label className="block">
            <span className={labelClass}>Secret address in iCal format</span>
            <input className={fieldClass} placeholder="https://calendar.google.com/calendar/ical/…" />
          </label>
          <button className={`${primaryButtonClass} mt-3`} type="submit">
            {imported ? "Import again" : "Import my calendar"}
          </button>
          {imported ? (
            <p className="mt-3 text-sm font-bold text-leaf" role="status">
              Imported {events.length} busy times from the next 60 days. This demo fills in a sample
              class schedule.
            </p>
          ) : null}
        </form>
      </div>

      <div className="calendar-frame mx-auto mt-10">
        <MonthCalendar
          events={events}
          hasCalendar={imported}
          meetups={meetups}
          month={month}
          otherMonth={other}
          today={isoDay(today)}
        />
      </div>
    </>
  );
}
