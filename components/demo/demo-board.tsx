"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MatchesBoard } from "@/components/matches-board";
import { Scrap } from "@/components/scrap";
import { demoMatches, readAnswers, withAnswers, writeAnswers, type DemoAnswers } from "@/lib/demo-data";
import { primaryButtonClass, secondaryButtonClass } from "@/lib/styles";
import type { MatchCardModel } from "@/lib/types";

export function DemoBoard() {
  const [matches, setMatches] = useState<MatchCardModel[] | null>(null);
  const [answers, setAnswers] = useState<DemoAnswers>({});
  const [again, setAgain] = useState<"" | "yes" | "no">("");

  // Dates depend on the visitor's clock, so the sample week is built after mount.
  useEffect(() => {
    setAnswers(readAnswers());
    setMatches(demoMatches(new Date()));
  }, []);

  if (!matches) return <p className="text-sm font-semibold text-muted">Setting the table…</p>;

  const shown = withAnswers(matches, answers);

  return (
    <>
      <h1>
        <Scrap tilt={-3}>
          <span className="font-script text-5xl leading-none ink-leaf">This week&rsquo;s</span>
        </Scrap>{" "}
        <Scrap shape={1} tilt={2}>
          <span className="font-serif text-4xl leading-none ink-rose">trays</span>
        </Scrap>
      </h1>

      <div className="paper-note mt-6 max-w-xl">
        {again ? (
          <p className="font-bold text-ink">
            {again === "yes"
              ? "Good to hear. People you'd eat with again shape who you get next Sunday."
              : "Noted. You won't be matched with Hannah again."}
          </p>
        ) : (
          <>
            <p className="font-bold text-ink">
              You had lunch with Hannah last week. Would you get a meal with her again?
            </p>
            <div className="mt-3 flex gap-2">
              <button className={`${primaryButtonClass} px-4 py-2`} onClick={() => setAgain("yes")} type="button">
                Yes
              </button>
              <button className={`${secondaryButtonClass} px-4 py-2`} onClick={() => setAgain("no")} type="button">
                Not really
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-8">
        <MatchesBoard
          chatBase="/demo/chat"
          deadlineNote="Say you're in by Tuesday at 8pm, or the lunch goes to someone else."
          hasQuestionnaire
          matches={shown}
          onRespond={async (matchId, response) => {
            const next = { ...answers, [matchId]: response };
            setAnswers(next);
            writeAnswers(next);
            return { ok: true };
          }}
        />
      </div>

      <p className="mt-8 text-sm font-semibold text-muted">
        Want the first tray back?{" "}
        <button
          className="font-extrabold text-leaf underline"
          onClick={() => {
            setAnswers({});
            writeAnswers({});
            setAgain("");
          }}
          type="button"
        >
          Start the week over
        </button>{" "}
        or <Link className="font-extrabold text-leaf underline" href="/demo/tray">change your own tray</Link>.
      </p>
    </>
  );
}
