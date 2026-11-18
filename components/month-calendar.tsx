import Link from "next/link";
import { freeHours } from "@/lib/plan";
import type { CalendarEvent } from "@/lib/types";

const WEEKDAYS = ["SUN", "MON", "TUES", "WED", "THURS", "FRI", "SAT"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const PATTERNS = ["cal-stripes", "cal-dots", "cal-gingham"];

export type Meetup = {
  date: string;
  hour: number;
  /** "Lunch with Dana" */
  label: string;
};

export function monthName(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}

/**
 * The month as a wall calendar: big green month name, pink hairline grid,
 * two-digit day numbers. Busy days list their first two events, a suggested
 * meetup turns the day green, and a day with no open hour between 11 AM and
 * 8 PM gets a patterned fill.
 */
export function MonthCalendar({
  month,
  today,
  events,
  meetups,
  hasCalendar,
  otherMonth,
}: {
  /** YYYY-MM */
  month: string;
  /** YYYY-MM-DD in New Haven */
  today: string;
  events: CalendarEvent[];
  meetups: Meetup[];
  hasCalendar: boolean;
  otherMonth: { href: string; label: string };
}) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leading = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();

  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));

  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (!event.date.startsWith(month)) continue;
    const list = eventsByDate.get(event.date) ?? [];
    list.push(event);
    eventsByDate.set(event.date, list);
  }
  const meetupByDate = new Map(meetups.map((meetup) => [meetup.date, meetup]));

  return (
    <section aria-label={`${monthName(month)} ${year}`} className="panel cal-panel">
      <h2 className="cal-month">{monthName(month)}</h2>
      <p className="cal-switch">
        <Link href={otherMonth.href}>{otherMonth.label}</Link>
      </p>

      <table className="cal-table">
        <thead>
          <tr>
            {WEEKDAYS.map((weekday, index) => (
              <th abbr={WEEKDAY_NAMES[index]} key={weekday} scope="col">
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, row) => (
            <tr key={row}>
              {week.map((day, column) => {
                if (day === null) return <td className="cal-blank" key={column} />;

                const date = `${month}-${String(day).padStart(2, "0")}`;
                const dayEvents = eventsByDate.get(date) ?? [];
                const meetup = meetupByDate.get(date);
                const packed =
                  hasCalendar &&
                  date >= today &&
                  dayEvents.length > 0 &&
                  !freeHours(events, date).some((hour) => hour >= 11 && hour < 20);

                const state = meetup
                  ? "cal-meetup"
                  : date === today
                    ? "cal-today"
                    : packed
                      ? `cal-packed ${PATTERNS[day % PATTERNS.length]}`
                      : "";
                const shown = dayEvents.slice(0, meetup ? 1 : 2);
                const extra = dayEvents.length - shown.length;

                return (
                  <td className={state} key={column}>
                    <div className="cal-cell">
                      <span className="cal-num">
                        {String(day).padStart(2, "0")}
                        {date === today ? <span className="sr-only"> (today)</span> : null}
                      </span>

                      {meetup ? (
                        <p className="cal-plan font-hand">
                          {meetup.label}
                          <span className="cal-plan-time"> {compactHour(meetup.hour)}</span>
                        </p>
                      ) : null}

                      {shown.length > 0 ? (
                        <ul className="cal-events">
                          {shown.map((event, index) => (
                            <li key={index}>
                              <span className="cal-time">{compactTime(event.start)}</span> {event.title}
                            </li>
                          ))}
                          {extra > 0 ? <li className="cal-more">+{extra} more</li> : null}
                        </ul>
                      ) : null}

                      {/* Phone width: the lines above are hidden and each event becomes a dot. */}
                      {dayEvents.length > 0 ? (
                        <span aria-hidden="true" className="cal-marks">
                          {dayEvents.slice(0, 3).map((_, index) => (
                            <i key={index} />
                          ))}
                        </span>
                      ) : null}
                      {packed && !meetup ? <span className="sr-only">No free time between 11 AM and 8 PM</span> : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="cal-key">
        <li>
          <span className="cal-swatch cal-today" /> Today
        </li>
        <li>
          <span className="cal-swatch cal-meetup" /> Suggested meetup
        </li>
        <li>
          <span className="cal-swatch cal-stripes" /> Booked from 11 to 8
        </li>
        <li className="cal-key-marks">
          <span aria-hidden="true" className="cal-marks">
            <i />
          </span>{" "}
          One dot per event
        </li>
      </ul>
    </section>
  );
}

/** "9:25a", "3p" */
function compactTime(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour >= 12 ? "p" : "a";
  return minute === 0 ? `${shown}${suffix}` : `${shown}:${String(minute).padStart(2, "0")}${suffix}`;
}

function compactHour(hour: number): string {
  return compactTime(hour * 60);
}
