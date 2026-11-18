import Link from "next/link";
import {
  compareCalendars,
  formatWindows,
  type AvailabilitySnapshot,
} from "@/lib/availability";
import { cardClass } from "@/lib/styles";

export function AvailabilityCompare({
  name,
  snapshot,
  missing = false,
}: {
  name: string;
  snapshot: AvailabilitySnapshot | null;
  /** True when migration 002 has not been run. */
  missing?: boolean;
}) {
  if (missing) {
    return (
      <section className={`${cardClass} mt-6`}>
        <h2 className="font-serif text-2xl text-ink">When you can both make it</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Availability isn&rsquo;t switched on for this site yet. Run{" "}
          <code>supabase/migrations/002_match_availability.sql</code> in the Supabase SQL editor.
        </p>
      </section>
    );
  }

  if (!snapshot) return null;

  const days = compareCalendars(snapshot);
  const bothConnected = snapshot.youConnected && snapshot.themConnected;

  return (
    <section className={`${cardClass} mt-6`}>
      <h2 className="font-serif text-2xl text-ink">When you can both make it</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Hours from 9 AM to 10 PM, New Haven time. A match sees when you&rsquo;re free, never the
        names of your events.{" "}
        <Link className="font-bold text-leaf underline" href="/calendar">
          Calendar
        </Link>
      </p>

      {!snapshot.youConnected && !snapshot.themConnected ? (
        <p className="mt-4 text-sm leading-6 text-ink">
          Neither of you has imported a calendar yet. Add yours and {name} can see when you&rsquo;re
          free.
        </p>
      ) : null}

      {snapshot.youConnected && !snapshot.themConnected ? (
        <p className="mt-4 text-sm leading-6 text-ink">
          {name} hasn&rsquo;t imported a calendar, so their hours aren&rsquo;t here. Yours is already
          shared with them.
        </p>
      ) : null}

      {!snapshot.youConnected && snapshot.themConnected ? (
        <p className="mt-4 text-sm leading-6 text-ink">
          {name} has shared their free hours. Import yours to see where they overlap.
        </p>
      ) : null}

      {snapshot.themConnected || snapshot.youConnected ? (
        <ul className="cal-free mt-3 text-sm leading-6 text-ink">
          {days.map((day) => (
            <li key={day.date}>
              <span className="font-extrabold">{day.label}</span>
              <span>{describeDay(day, name, bothConnected, snapshot)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function describeDay(
  day: ReturnType<typeof compareCalendars>[number],
  name: string,
  bothConnected: boolean,
  snapshot: AvailabilitySnapshot,
): string {
  const parts: string[] = [];

  if (bothConnected) {
    parts.push(day.both.length > 0 ? `Both free ${formatWindows(day.both)}` : "No shared hour");
  }
  if (snapshot.themConnected) {
    parts.push(day.them.length > 0 ? `${name} ${formatWindows(day.them)}` : `${name} is booked`);
  }
  if (snapshot.youConnected) {
    parts.push(day.you.length > 0 ? `You ${formatWindows(day.you)}` : "You're booked");
  }

  return parts.join(". ");
}
