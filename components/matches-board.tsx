"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToMatch } from "@/app/actions/matches";
import { Scrap } from "@/components/scrap";
import { Tray } from "@/components/tray";
import { formatWeek } from "@/lib/drop";
import { primaryButtonClass, roseButtonClass, secondaryButtonClass } from "@/lib/styles";
import { partnerName, planLine, possessive } from "@/lib/tray";
import type { MatchCardModel, MatchType } from "@/lib/types";

type Answer = "interested" | "passed";

/** A match plus where it sits in the full list, which picks its backdrop. */
type DeckCard = MatchCardModel & { order: number };

export function MatchesBoard({
  matches,
  hasQuestionnaire,
  needsTray = false,
}: {
  matches: MatchCardModel[];
  hasQuestionnaire: boolean;
  needsTray?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<MatchType>("friend");
  // Answers we have sent but the server has not confirmed on this page yet.
  const [sent, setSent] = useState<Record<string, Answer>>({});
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const cards = useMemo<DeckCard[]>(
    () =>
      matches.map((match, order) => {
        const answer = match.viewerResponse === "pending" ? sent[match.id] : undefined;
        if (!answer) return { ...match, order };
        return {
          ...match,
          order,
          viewerResponse: answer,
          status:
            answer === "passed"
              ? "closed"
              : match.partnerResponse === "interested"
                ? "mutual"
                : match.status,
        };
      }),
    [matches, sent],
  );

  const inTab = cards.filter((card) => card.matchType === tab);
  const waiting = inTab.filter((card) => card.viewerResponse === "pending" && card.status !== "closed");
  const answered = inTab.filter((card) => !waiting.includes(card));
  const newCount = (type: MatchType) =>
    cards.filter(
      (card) =>
        card.matchType === type && card.viewerResponse === "pending" && card.status !== "closed",
    ).length;

  function answer(matchId: string, response: Answer) {
    setError("");
    setSent((current) => ({ ...current, [matchId]: response }));
    startTransition(async () => {
      const result = await respondToMatch(matchId, response);
      if (!result.ok) {
        // Undo the optimistic answer so the card returns to the deck.
        setSent((current) => {
          const next = { ...current };
          delete next[matchId];
          return next;
        });
        setError(`That didn't save, so nothing changed. ${result.message}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="paper-tabs max-w-md" role="tablist">
        <TabButton active={tab === "friend"} count={newCount("friend")} onClick={() => setTab("friend")}>
          Friends
        </TabButton>
        <TabButton active={tab === "study"} count={newCount("study")} onClick={() => setTab("study")}>
          Study buddies
        </TabButton>
      </div>

      {needsTray ? (
        <p className="mt-6">
          <Link className="inline-block" href="/tray">
            <Scrap shape={1} tilt={-1.5}>
              <span className="text-base font-extrabold ink-leaf underline decoration-2 underline-offset-2">
                Fill your tray so people see more than your college
              </span>
            </Scrap>
          </Link>
        </p>
      ) : null}

      {error ? (
        <p className="mt-6 border-2 border-alert bg-white px-4 py-3 text-sm font-bold text-alert" role="alert">
          {error}
        </p>
      ) : null}

      {inTab.length === 0 ? (
        <EmptyState hasQuestionnaire={hasQuestionnaire} tab={tab} />
      ) : (
        <>
          {waiting.length > 0 ? (
            <SwipeDeck cards={waiting} key={tab} onAnswer={answer} />
          ) : (
            <p className="mt-8 text-center">
              <Scrap tilt={-2}>
                <span className="font-serif text-2xl ink-leaf">That&rsquo;s everyone for now</span>
              </Scrap>
            </p>
          )}
          {answered.length > 0 ? <AnsweredList cards={answered} onAnswer={answer} /> : null}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      aria-selected={active}
      className="paper-tab"
      onClick={onClick}
      role="tab"
      type="button"
    >
      {children}
      {count > 0 ? (
        <span
          className="ml-2 inline-block min-w-6 bg-rose px-1.5 text-center text-xs leading-5 text-white"
        >
          {count}
          <span className="sr-only"> waiting for your answer</span>
        </span>
      ) : null}
    </button>
  );
}

function EmptyState({ tab, hasQuestionnaire }: { tab: MatchType; hasQuestionnaire: boolean }) {
  if (!hasQuestionnaire) {
    return (
      <div className="panel mt-6 px-6 py-8">
        <p className="text-lg font-black text-ink">Do the questionnaire first.</p>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Matching runs on your answers, so there&rsquo;s nothing to show until they&rsquo;re in.
        </p>
        <Link className={`${primaryButtonClass} mt-4`} href="/questionnaire">
          Open the questionnaire
        </Link>
      </div>
    );
  }

  return (
    <div className="panel mt-6 px-6 py-8">
      <p className="text-lg font-black text-ink">
        {tab === "friend" ? "No friend matches yet." : "No study buddies yet."}
      </p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        {tab === "friend"
          ? "They come out Mondays at 9am. If you just finished the questionnaire, you're in the next round."
          : "This list is optional. Turn it on at the end of the questionnaire if you want a study buddy."}
      </p>
    </div>
  );
}

/* ---------- The deck ---------- */

function SwipeDeck({
  cards,
  onAnswer,
}: {
  cards: DeckCard[];
  onAnswer: (matchId: string, response: Answer) => void;
}) {
  const top = cards[0];
  const [leaving, setLeaving] = useState<{ id: string; direction: 1 | -1 } | null>(null);
  const timer = useRef<number | null>(null);

  function decide(response: Answer) {
    if (!top || leaving) return;
    const still =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      onAnswer(top.id, response);
      return;
    }
    const id = top.id;
    setLeaving({ id, direction: response === "interested" ? 1 : -1 });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setLeaving(null);
      onAnswer(id, response);
    }, 240);
  }

  const name = partnerName(top.partner.firstName, top.partner.college);
  // Draw the top three, bottom card first so the top one sits above.
  const shown = cards.slice(0, 3).reverse();

  return (
    <section className="mt-8">
      <div
        aria-label={`${cards.length === 1 ? "1 tray" : `${cards.length} trays`} to answer. Showing ${name}. Right arrow for interested, left arrow to pass.`}
        className="deck"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            decide("interested");
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            decide("passed");
          }
        }}
        role="group"
        tabIndex={0}
      >
        {shown.map((card) => {
          const depth = cards.indexOf(card);
          return depth === 0 ? (
            <TopCard
              card={card}
              key={card.id}
              leaving={leaving?.id === card.id ? leaving.direction : 0}
              onDecide={decide}
            />
          ) : (
            <div aria-hidden="true" className={`deck-card deck-card-under deck-card-under-${depth}`} key={card.id}>
              <CardFace card={card} />
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          className={`${roseButtonClass} min-w-28 px-6 py-3 text-base`}
          disabled={Boolean(leaving)}
          onClick={() => decide("passed")}
          type="button"
        >
          Pass
        </button>
        <button
          className={`${primaryButtonClass} min-w-28 px-6 py-3 text-base`}
          disabled={Boolean(leaving)}
          onClick={() => decide("interested")}
          type="button"
        >
          Interested
        </button>
      </div>
      <p className="mx-auto mt-3 max-w-sm text-center text-sm text-muted">
        Drag the card right if you&rsquo;re interested, left to pass. They only find out if you both
        say interested.
      </p>
    </section>
  );
}

function TopCard({
  card,
  leaving,
  onDecide,
}: {
  card: DeckCard;
  leaving: 1 | -1 | 0;
  onDecide: (response: Answer) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const element = useRef<HTMLDivElement>(null);

  function release() {
    if (!dragging) return;
    setDragging(false);
    const width = element.current?.offsetWidth ?? 320;
    const threshold = Math.min(130, width * 0.3);
    if (Math.abs(offset) > threshold) {
      onDecide(offset > 0 ? "interested" : "passed");
      // Leave the offset alone so the card keeps going from where it was let go.
      return;
    }
    setOffset(0);
  }

  const transform =
    leaving !== 0
      ? `translateX(${leaving * 130}vw) rotate(${leaving * 22}deg)`
      : `translateX(${offset}px) rotate(${offset / 22}deg)`;

  return (
    <div
      className={`deck-card deck-card-top ${dragging ? "deck-card-dragging" : ""}`}
      onPointerCancel={release}
      onPointerDown={(event) => {
        if (leaving !== 0) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if ((event.target as HTMLElement).closest("a, button")) return;
        startX.current = event.clientX;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (dragging) setOffset(event.clientX - startX.current);
      }}
      onPointerUp={release}
      ref={element}
      style={{ transform }}
    >
      <CardFace card={card} />
      <span
        aria-hidden="true"
        className="deck-stamp deck-stamp-yes"
        style={{ opacity: leaving === 1 ? 1 : Math.max(0, Math.min(1, offset / 90)) }}
      >
        <Scrap tilt={-8} white>
          <span className="font-serif text-2xl ink-leaf">Interested</span>
        </Scrap>
      </span>
      <span
        aria-hidden="true"
        className="deck-stamp deck-stamp-no"
        style={{ opacity: leaving === -1 ? 1 : Math.max(0, Math.min(1, -offset / 90)) }}
      >
        <Scrap shape={1} tilt={8} white>
          <span className="font-serif text-2xl ink-rose">Pass</span>
        </Scrap>
      </span>
    </div>
  );
}

function whoLine(card: MatchCardModel): string {
  const { firstName, college, classYear } = card.partner;
  const year = classYear > 0 ? `class of ${classYear}` : "";
  if (firstName.trim()) return [college || "Yale", year].filter(Boolean).join(", ");
  return [partnerName("", college), year].filter(Boolean).join(", ");
}

function CardFace({ card }: { card: DeckCard }) {
  const first = card.partner.firstName.trim();

  return (
    <article className={`deck-face ${card.order % 2 === 0 ? "bg-desk" : "bg-locker"}`}>
      <h3 className="deck-title">
        <Scrap tilt={-4}>
          <span className="deck-title-script font-script ink-leaf">What&rsquo;s on</span>
        </Scrap>
        <Scrap shape={1} tilt={2.5}>
          <span className="deck-title-name font-serif ink-rose">
            {first ? possessive(first) : "this"} <span className="ink-leaf">tray</span>
          </span>
        </Scrap>
      </h3>

      <div className="deck-tray">
        <Tray items={card.partner.tray} />
      </div>

      <p className="deck-who">
        <Scrap shape={2} tilt={-2} white>
          <span className="text-sm font-black ink-rose">{whoLine(card)}</span>
        </Scrap>
      </p>

      <p className="deck-why">
        <Scrap className="deck-note" shape={1} tilt={1}>
          {card.whyMatched}
        </Scrap>
      </p>

      {card.plan ? (
        <p className="deck-plan">
          <Scrap className="deck-note deck-note-plan" tilt={-1.5} white>
            {planLine(card.plan)}
          </Scrap>
        </p>
      ) : null}
    </article>
  );
}

/* ---------- Already answered ---------- */

function AnsweredList({
  cards,
  onAnswer,
}: {
  cards: DeckCard[];
  onAnswer: (matchId: string, response: Answer) => void;
}) {
  return (
    <section className="panel mt-10 px-5 py-5 sm:px-6">
      <h2 className="text-lg font-black text-ink">Already answered</h2>
      <ul className="mt-2 divide-y-2 divide-hairline/50">
        {cards.map((card) => {
          const mutual = card.status === "mutual";
          const closed = card.status === "closed";
          const waitingOnThem = !mutual && !closed && card.viewerResponse === "interested";
          return (
            <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3" key={card.id}>
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-ink">
                  {partnerName(card.partner.firstName, card.partner.college)}
                </p>
                <p className="text-sm text-muted">
                  {card.partner.firstName.trim() ? `${whoLine(card)}, ` : ""}
                  week of {formatWeek(card.weekStart)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {mutual ? (
                  <Link className={`${primaryButtonClass} px-4 py-2`} href={`/chat/${card.id}`}>
                    Open chat
                  </Link>
                ) : null}
                {waitingOnThem ? (
                  <>
                    <span className="text-sm font-bold text-muted">Waiting on them</span>
                    <button
                      className={`${secondaryButtonClass} px-3 py-1.5`}
                      onClick={() => onAnswer(card.id, "passed")}
                      type="button"
                    >
                      Pass
                    </button>
                  </>
                ) : null}
                {closed ? (
                  <span className="text-sm font-bold text-muted">
                    {card.viewerResponse === "passed" ? "You passed" : "Closed"}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
