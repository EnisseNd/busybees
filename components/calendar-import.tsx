"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { importCalendar, removeCalendar } from "@/app/actions/calendar";
import { looksLikeIcs, slimIcs } from "@/lib/ics";
import {
  fieldClass,
  labelClass,
  primaryButtonClass,
  roseButtonClass,
  secondaryButtonClass,
} from "@/lib/styles";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
/** Server actions accept about 1 MB, so the trimmed file has to fit under that. */
const MAX_UPLOAD_CHARS = 900_000;

type Notice = { tone: "ok" | "error"; text: string } | null;

export function CalendarImport({
  hasCalendar,
  eventCount,
  importedOn,
  setupMissing,
}: {
  hasCalendar: boolean;
  eventCount: number;
  /** "Nov 17", or empty when nothing has been imported. */
  importedOn: string;
  /** True when the calendars table has not been created yet. */
  setupMissing: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();

  function finish(result: { ok: boolean; message: string }) {
    setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
    if (result.ok) {
      setUrl("");
      router.refresh();
    }
  }

  function importLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const link = url.trim();
    if (!link) {
      setNotice({ tone: "error", text: "Paste the secret address first." });
      return;
    }
    setNotice(null);
    startTransition(async () => finish(await importCalendar({ kind: "link", url: link })));
  }

  function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setNotice({ tone: "error", text: "That file is over 2 MB. Export a single calendar and try again." });
      return;
    }

    setNotice(null);
    startTransition(async () => {
      const text = await file.text();
      if (!looksLikeIcs(text)) {
        finish({ ok: false, message: "That doesn't look like a calendar file. It should end in .ics." });
        return;
      }
      // Only dates, repeats and titles are sent. Descriptions and guest lists stay on this device.
      const slim = slimIcs(text);
      if (slim.length > MAX_UPLOAD_CHARS) {
        finish({ ok: false, message: "That calendar has too many events to upload at once. Export a single calendar and try again." });
        return;
      }
      finish(await importCalendar({ kind: "file", text: slim }));
    });
  }

  function remove() {
    setNotice(null);
    startTransition(async () => finish(await removeCalendar()));
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.1fr]">
      <div>
        <h2 className="font-serif text-2xl text-ink">Bring in your Google Calendar</h2>
        <ol className="cal-steps mt-3 text-sm leading-6 text-ink">
          <li>Open Google Calendar on a computer. Click the gear, then Settings.</li>
          <li>Under &ldquo;Settings for my calendars&rdquo;, click the calendar you want.</li>
          <li>
            Click &ldquo;Integrate calendar&rdquo; and copy the &ldquo;Secret address in iCal
            format&rdquo;.
          </li>
          <li>Paste it here.</li>
        </ol>
        <p className="mt-4 text-sm leading-6 text-muted">
          This is a one-time copy of the next 60 days. If your schedule changes, import again and
          the new copy replaces the old one. We use the address once and don&rsquo;t keep it.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Event names stay private. A match only ever sees the time and place we suggest.
        </p>
      </div>

      <div>
        {setupMissing ? (
          <p className="mb-4 rounded-xl border-2 border-hairline bg-white px-3 py-2 text-sm leading-6 text-ink" role="status">
            Calendars aren&rsquo;t switched on for this site yet. Whoever runs the database needs
            to run <code>supabase/migrations/001_trays_and_calendar.sql</code> first.
          </p>
        ) : null}

        <form className="grid gap-3" onSubmit={importLink}>
          <label className="block">
            <span className={labelClass}>Secret address in iCal format</span>
            <input
              autoComplete="off"
              className={fieldClass}
              disabled={pending}
              inputMode="url"
              name="calendar-link"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/..."
              spellCheck={false}
              type="url"
              value={url}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button className={primaryButtonClass} disabled={pending} type="submit">
              {pending ? "Importing…" : hasCalendar ? "Import again" : "Import calendar"}
            </button>
            <button
              className={secondaryButtonClass}
              disabled={pending}
              onClick={() => fileInput.current?.click()}
              type="button"
            >
              Upload an .ics file
            </button>
            <input
              accept=".ics,text/calendar"
              aria-label="Calendar file"
              className="sr-only"
              onChange={importFile}
              ref={fileInput}
              tabIndex={-1}
              type="file"
            />
          </div>
        </form>

        {notice ? (
          <p
            className={`mt-4 rounded-xl px-3 py-2 text-sm font-bold ${
              notice.tone === "error" ? "bg-white text-alert" : "bg-white text-leaf"
            }`}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            {notice.text}
          </p>
        ) : null}

        {hasCalendar ? (
          <div className="mt-6 border-t border-hairline pt-4">
            <p className="text-sm leading-6 text-ink">
              {eventCount === 0
                ? `Imported ${importedOn}. Nothing on it for the next 60 days.`
                : `Imported ${importedOn}: ${eventCount} busy ${eventCount === 1 ? "block" : "blocks"}.`}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Removing it deletes everything we saved from your calendar. Meetups already suggested
              stay on your matches.
            </p>
            <button className={`${roseButtonClass} mt-3`} disabled={pending} onClick={remove} type="button">
              Remove my calendar
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
