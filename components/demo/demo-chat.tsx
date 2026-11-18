"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Scrap } from "@/components/scrap";
import { Tray } from "@/components/tray";
import { demoMatches } from "@/lib/demo-data";
import { googleCalendarLink } from "@/lib/plan";
import { cardClass, fieldClass, primaryButtonClass } from "@/lib/styles";
import { planLine, starterLine } from "@/lib/tray";
import { useMounted } from "@/lib/use-mounted";

type Note = { id: number; mine: boolean; text: string };

const REPLIES = [
  "yes!! that works for me",
  "ok wait I have so many questions about your tray",
  "see you there. I'll grab a table by the windows",
  "perfect, I get out of class right before",
];

export function DemoChat({ matchId }: { matchId: string }) {
  const mounted = useMounted();
  const match = useMemo(
    () => (mounted ? (demoMatches(new Date()).find((item) => item.id === matchId) ?? null) : undefined),
    [mounted, matchId],
  );
  const [sent, setSent] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const replies = useRef(0);
  const bottom = useRef<HTMLDivElement | null>(null);

  const notes: Note[] = match
    ? [
        {
          id: 1,
          mine: false,
          text: `hi! I'm ${match.partner.firstName}. are you still good for ${match.plan?.activity.toLowerCase() ?? "lunch"}?`,
        },
        ...sent,
      ]
    : sent;

  useEffect(() => {
    if (sent.length > 0) bottom.current?.scrollIntoView({ block: "end" });
  }, [sent]);

  if (match === undefined) return <p className="text-sm font-semibold text-muted">Opening chat…</p>;
  if (match === null) {
    return (
      <p className="font-bold text-ink">
        That chat isn&rsquo;t part of the sample week.{" "}
        <Link className="text-leaf underline" href="/demo">Back to the trays</Link>
      </p>
    );
  }

  const name = match.partner.firstName;
  const starter = starterLine(match.partner.tray, match.id);

  function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    setSent((current) => [...current, { id: Date.now(), mine: true, text: body }]);
    const reply = REPLIES[replies.current % REPLIES.length];
    replies.current += 1;
    window.setTimeout(() => {
      setSent((current) => [...current, { id: Date.now() + 1, mine: false, text: reply }]);
    }, 1400);
  }

  return (
    <>
      <Link className="text-sm font-extrabold text-leaf underline underline-offset-2" href="/demo">
        Back to the trays
      </Link>

      <header className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="chat-tray">
          <Tray items={match.partner.tray} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-4xl leading-tight text-ink">{name}</h1>
          <p className="mt-1 text-sm font-bold text-muted">
            {match.partner.college}, class of {match.partner.classYear}
          </p>
          <p className="mt-3">
            <Scrap className="deck-note" shape={1} tilt={-1}>{match.whyMatched}</Scrap>
          </p>
          {match.plan ? (
            <p className="mt-2">
              <Scrap className="deck-note deck-note-plan" tilt={1} white>{planLine(match.plan)}</Scrap>
            </p>
          ) : null}
          {match.plan ? (
            <p className="mt-3">
              <a
                className="text-sm font-extrabold text-leaf underline"
                href={googleCalendarLink(match.plan, `${match.plan.activity} with ${name}`)}
                rel="noreferrer"
                target="_blank"
              >
                Add it to Google Calendar
              </a>
            </p>
          ) : null}
        </div>
      </header>

      {match.sharedFree ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="font-serif text-2xl text-ink">When you can both make it</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-ink">{match.sharedFree}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Sample hours. On a real match this list comes from the Google Calendars you both imported,
            and it never includes event names.
          </p>
        </section>
      ) : null}

      <div className="mt-6 flex min-h-[18rem] flex-col gap-3">
        {starter ? <p className="text-sm font-semibold text-muted">{starter}</p> : null}
        {notes.map((note) => (
          <div className={note.mine ? "flex justify-end" : "flex justify-start"} key={note.id}>
            <div className={note.mine ? "chat-note chat-note-mine" : "chat-note"}>
              <p>{note.text}</p>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form className="mt-4 flex items-end gap-2" onSubmit={send}>
        <label className="flex-1">
          <span className="sr-only">Message</span>
          <input
            className={fieldClass}
            maxLength={500}
            onChange={(event) => setText(event.target.value)}
            placeholder={`Message ${name}`}
            value={text}
          />
        </label>
        <button className={primaryButtonClass} type="submit">Send</button>
      </form>
    </>
  );
}
