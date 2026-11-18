"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { looksLikeIcs, parseIcs } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_HOST = "calendar.google.com";
const MAX_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

const SETUP_MESSAGE =
  "Calendars aren't set up on this site yet. Run supabase/migrations/001_trays_and_calendar.sql in the Supabase SQL editor, then import again.";

export type CalendarSource =
  | { kind: "link"; url: string }
  | { kind: "file"; text: string };

type ImportResult = { ok: true; message: string; count: number } | { ok: false; message: string };

export async function importCalendar(source: CalendarSource): Promise<ImportResult> {
  const profile = await requireUser();
  if (profile.needsProfile) {
    return {
      ok: false,
      message: "Your profile row is missing. Sign out and create the account again.",
    };
  }

  let text = "";
  let label = "ics-file";

  if (source?.kind === "link") {
    const fetched = await fetchGoogleCalendar(String(source.url ?? ""));
    if (!fetched.ok) return fetched;
    text = fetched.text;
    label = "google-ics";
  } else if (source?.kind === "file") {
    text = String(source.text ?? "");
    if (text.length > MAX_BYTES) {
      return { ok: false, message: "That file is over 2 MB. Export a single calendar and try again." };
    }
  } else {
    return { ok: false, message: "Paste a calendar link or choose an .ics file." };
  }

  if (!looksLikeIcs(text)) {
    return {
      ok: false,
      message:
        source.kind === "link"
          ? "That link didn't return a calendar. Copy the secret address again and paste the whole thing."
          : "That doesn't look like a calendar file. It should end in .ics.",
    };
  }

  const events = parseIcs(text);
  const supabase = await createClient();
  const { error } = await supabase.from("calendars").upsert({
    user_id: profile.id,
    events,
    source: label,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return { ok: false, message: isMissingTable(error) ? SETUP_MESSAGE : error.message };
  }

  revalidatePath("/calendar");
  return {
    ok: true,
    count: events.length,
    message:
      events.length === 0
        ? "Imported, but there's nothing on that calendar in the next 60 days."
        : `Imported ${events.length} busy ${events.length === 1 ? "block" : "blocks"} from the next 60 days.`,
  };
}

export async function removeCalendar(): Promise<{ ok: boolean; message: string }> {
  const profile = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("calendars").delete().eq("user_id", profile.id);

  if (error) {
    return { ok: false, message: isMissingTable(error) ? SETUP_MESSAGE : error.message };
  }

  revalidatePath("/calendar");
  return { ok: true, message: "Your calendar is gone from busybee." };
}

function isMissingTable(error: { message: string; code?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /could not find the table|relation .* does not exist/i.test(error.message)
  );
}

/** Only Google's own iCal addresses are fetched, so the server can't be pointed anywhere else. */
function googleCalendarUrl(input: string): URL | null {
  let url: URL;
  try {
    url = new URL(input.trim().replace(/^webcal:\/\//i, "https://"));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== GOOGLE_HOST) return null;
  if (url.port || url.username || url.password) return null;
  if (!url.pathname.startsWith("/calendar/ical/")) return null;
  return url;
}

async function fetchGoogleCalendar(
  input: string,
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const first = googleCalendarUrl(input);
  if (!first) {
    return {
      ok: false,
      message:
        "That isn't a Google Calendar secret address. It starts with https://calendar.google.com/calendar/ical/ and ends in .ics.",
    };
  }

  let url: URL = first;
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response: Response = await fetch(url, {
        cache: "no-store",
        redirect: "manual",
        signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location: string | null = response.headers.get("location");
        const next: URL | null = location
          ? googleCalendarUrl(new URL(location, url).toString())
          : null;
        if (!next) {
          return { ok: false, message: "Google sent that link somewhere else, so we stopped. Copy the secret address again." };
        }
        url = next;
        continue;
      }

      if (response.status === 404 || response.status === 403) {
        return {
          ok: false,
          message: "Google wouldn't open that link. If you reset the secret address, copy the new one.",
        };
      }
      if (!response.ok) {
        return { ok: false, message: `Google Calendar answered with an error (${response.status}). Try again in a minute.` };
      }

      const text = await readCapped(response);
      if (text === null) {
        return { ok: false, message: "That calendar is over 2 MB. Upload an .ics export of a single calendar instead." };
      }
      return { ok: true, text };
    }
    return { ok: false, message: "Google kept redirecting that link, so we stopped. Copy the secret address again." };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok: false,
      message: timedOut
        ? "Google Calendar took more than 10 seconds to answer. Try again."
        : "We couldn't reach Google Calendar. Try again, or upload an .ics file instead.",
    };
  }
}

/** Reads the body, giving up as soon as it passes the size cap. */
async function readCapped(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return null;
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}
