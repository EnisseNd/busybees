import type { SupabaseClient } from "@supabase/supabase-js";
import { weekStartISO } from "@/lib/drop";
import { normalizeEvents, suggestPlan } from "@/lib/plan";
import { parseStoredAnswers } from "@/lib/questionnaire";
import type {
  CalendarEvent,
  FriendAnswers,
  MatchPlan,
  MatchType,
  StudyAnswers,
} from "@/lib/types";

/**
 * Friend matching is the main score. Study matching runs only when both
 * people opted in. Weights stay in this file so a later version can swap in
 * embeddings or a real assignment solver without touching the pages.
 *
 * `generateWeeklyMatches` is the cron entry point. Pass a service-role
 * client. Running it again for the same week does not reset responses.
 */

const FRIEND_WEIGHTS = {
  energy: 25,
  group: 10,
  interests: 35,
  lifestyle: 15,
  lookingFor: 15,
} as const;

const STUDY_WEIGHTS = {
  subjects: 30,
  courses: 10,
  style: 25,
  availability: 25,
  goal: 10,
} as const;

const ENERGY_RANK = { low: 0, medium: 1, high: 2 } as const;

const ENERGY_PHRASE = {
  low: "low-key",
  medium: "in the middle socially",
  high: "high-energy",
} as const;

const STYLE_PHRASE = {
  silent: "quiet study",
  collaborative: "working problems out loud",
  pomodoro: "pomodoro sessions",
  "teach-back": "teaching the material back",
} as const;

const GOAL_PHRASE = {
  accountability: "accountability",
  "problem-sets": "problem sets",
  "exam-prep": "exam prep",
  reading: "getting through the reading",
} as const;

export type MatchCandidate = {
  userId: string;
  friend: FriendAnswers;
  study?: StudyAnswers;
  lookingForStudyBuddy: boolean;
};

export type PlannedMatch = {
  userId: string;
  matchedUserId: string;
  matchType: MatchType;
  score: number;
  whyMatched: string;
};

export type WeeklyMatchOptions = {
  now?: Date;
  friendsPerUser?: number;
  minFriendScore?: number;
  minStudyScore?: number;
};

type QuestionnaireRecord = {
  user_id: string;
  answers: unknown;
  looking_for_study_buddy: boolean;
};

type MatchInsert = {
  user_id: string;
  matched_user_id: string;
  week_start: string;
  match_type: MatchType;
  score: number;
  why_matched: string;
  status: "pending";
  user_response: "pending";
  matched_response: "pending";
  /** Suggested time and place, when both people imported a calendar. */
  plan?: MatchPlan | null;
};

export function scoreFriendMatch(a: FriendAnswers, b: FriendAnswers): number {
  const energyGap = Math.abs(ENERGY_RANK[a.socialEnergy] - ENERGY_RANK[b.socialEnergy]);
  const energyScore = energyGap === 0 ? FRIEND_WEIGHTS.energy : energyGap === 1 ? 12 : 0;
  const groupScore =
    a.groupSize === b.groupSize || a.groupSize === "mix" || b.groupSize === "mix"
      ? FRIEND_WEIGHTS.group
      : 0;
  const lifestyleHits = [
    a.lifestyle.sleep === b.lifestyle.sleep ||
      a.lifestyle.sleep === "flexible" ||
      b.lifestyle.sleep === "flexible",
    a.lifestyle.weekend === b.lifestyle.weekend ||
      a.lifestyle.weekend === "mix" ||
      b.lifestyle.weekend === "mix",
    a.lifestyle.dining === b.lifestyle.dining,
  ].filter(Boolean).length;

  return clampScore(
    energyScore +
      groupScore +
      jaccard(a.interests, b.interests) * FRIEND_WEIGHTS.interests +
      (lifestyleHits / 3) * FRIEND_WEIGHTS.lifestyle +
      jaccard(a.lookingFor, b.lookingFor) * FRIEND_WEIGHTS.lookingFor,
  );
}

export function scoreStudyMatch(a: StudyAnswers, b: StudyAnswers): number {
  const styleScore = a.studyStyle === b.studyStyle ? STUDY_WEIGHTS.style : 0;
  const goalScore = a.goal === b.goal ? STUDY_WEIGHTS.goal : 0;

  return clampScore(
    jaccard(a.subjects, b.subjects) * STUDY_WEIGHTS.subjects +
      jaccard(courseTokens(a.courses), courseTokens(b.courses)) * STUDY_WEIGHTS.courses +
      styleScore +
      jaccard(a.availability, b.availability) * STUDY_WEIGHTS.availability +
      goalScore,
  );
}

export function explainFriendMatch(a: FriendAnswers, b: FriendAnswers): string {
  const parts: string[] = [];
  if (a.socialEnergy === b.socialEnergy) {
    parts.push(`you're both ${ENERGY_PHRASE[a.socialEnergy]}`);
  }

  const sharedLooking = shared(a.lookingFor, b.lookingFor).slice(0, 2);
  if (sharedLooking.length > 0) {
    parts.push(`you both want ${humanJoin(sharedLooking)}`);
  }

  const sharedInterests = shared(a.interests, b.interests).slice(0, 3);
  if (sharedInterests.length > 0) {
    parts.push(`you overlap on ${humanJoin(sharedInterests)}`);
  } else if (a.lifestyle.weekend === b.lifestyle.weekend) {
    parts.push("your weekends look similar");
  }

  return clip(sentence(parts, "Your answers landed in a similar range. Worth a low-stakes hello."));
}

export function explainStudyMatch(a: StudyAnswers, b: StudyAnswers): string {
  const parts: string[] = [];
  const subjects = shared(a.subjects, b.subjects).slice(0, 2);
  if (subjects.length > 0) parts.push(`you both listed ${humanJoin(subjects)}`);

  const courses = shared(courseTokens(a.courses), courseTokens(b.courses)).slice(0, 2);
  if (courses.length > 0) {
    parts.push(`you both mentioned ${humanJoin(courses.map(prettyCourse))}`);
  }

  if (a.studyStyle === b.studyStyle) {
    parts.push(`you both like ${STYLE_PHRASE[a.studyStyle]}`);
  }

  const times = shared(a.availability, b.availability).slice(0, 2);
  if (times.length > 0) parts.push(`you're both free ${humanJoin(times).toLowerCase()}`);

  if (parts.length < 2 && a.goal === b.goal) {
    parts.push(`you both want ${GOAL_PHRASE[a.goal]}`);
  }

  return clip(sentence(parts, "Your study habits landed in a similar range."));
}

/**
 * Greedy by score, deterministic when scores tie. Each person gets up to
 * `friendsPerUser` friend matches and one study match. Someone with no pair
 * above the floor still gets their best friend match if it clears a lower bar.
 */
export function planWeeklyMatches(
  people: MatchCandidate[],
  options: WeeklyMatchOptions = {},
): PlannedMatch[] {
  const friendsPerUser = options.friendsPerUser ?? 3;
  const minFriendScore = options.minFriendScore ?? 30;
  const minStudyScore = options.minStudyScore ?? 30;
  const friendLoad = new Map<string, number>();
  const studyLoad = new Map<string, number>();
  const chosen: PlannedMatch[] = [];
  const seen = new Set<string>();

  const friendPairs = pairPeople(people, (left, right) => {
    const score = scoreFriendMatch(left.friend, right.friend);
    return {
      score,
      whyMatched: explainFriendMatch(left.friend, right.friend),
      matchType: "friend" as const,
    };
  }).filter((pair) => pair.score >= minFriendScore);

  takePairs(friendPairs, friendsPerUser, friendLoad, seen, chosen);

  for (const person of people) {
    if ((friendLoad.get(person.userId) ?? 0) > 0) continue;
    const best = bestPartner(people, person, (left, right) =>
      scoreFriendMatch(left.friend, right.friend),
    );
    if (!best || best.score < 18) continue;
    if ((friendLoad.get(best.other.userId) ?? 0) >= friendsPerUser + 1) continue;
    const [userId, matchedUserId] = canonicalPair(person.userId, best.other.userId);
    const key = `friend:${userId}:${matchedUserId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    friendLoad.set(person.userId, (friendLoad.get(person.userId) ?? 0) + 1);
    friendLoad.set(best.other.userId, (friendLoad.get(best.other.userId) ?? 0) + 1);
    chosen.push({
      userId,
      matchedUserId,
      matchType: "friend",
      score: best.score,
      whyMatched: explainFriendMatch(person.friend, best.other.friend),
    });
  }

  const studyPeople = people.filter((person) => person.lookingForStudyBuddy && person.study);
  const studyPairs = pairPeople(studyPeople, (left, right) => {
    const score = scoreStudyMatch(left.study as StudyAnswers, right.study as StudyAnswers);
    return {
      score,
      whyMatched: explainStudyMatch(left.study as StudyAnswers, right.study as StudyAnswers),
      matchType: "study" as const,
    };
  }).filter((pair) => pair.score >= minStudyScore);

  takePairs(studyPairs, 1, studyLoad, seen, chosen);
  return chosen;
}

export async function generateWeeklyMatches(
  supabase: SupabaseClient,
  options: WeeklyMatchOptions = {},
): Promise<{ weekStart: string; considered: number; planned: number }> {
  const { data, error } = await supabase
    .from("questionnaires")
    .select("user_id, answers, looking_for_study_buddy");

  if (error) throw new Error(error.message);

  const people: MatchCandidate[] = [];
  for (const row of (data ?? []) as QuestionnaireRecord[]) {
    const answers = parseStoredAnswers(row.answers);
    if (!answers) continue;
    people.push({
      userId: row.user_id,
      friend: answers.friend,
      study: answers.study,
      lookingForStudyBuddy: Boolean(row.looking_for_study_buddy && answers.study),
    });
  }

  const planned = planWeeklyMatches(people, options);
  const now = options.now ?? new Date();
  const weekStart = weekStartISO(now);
  if (planned.length === 0) {
    return { weekStart, considered: people.length, planned: 0 };
  }

  const pairedIds = Array.from(
    new Set(planned.flatMap((match) => [match.userId, match.matchedUserId])),
  );
  const { calendars, colleges } = await loadPlanInputs(supabase, pairedIds);

  const rows: MatchInsert[] = planned.map((match) => ({
    user_id: match.userId,
    matched_user_id: match.matchedUserId,
    week_start: weekStart,
    match_type: match.matchType,
    score: match.score,
    why_matched: match.whyMatched,
    status: "pending",
    user_response: "pending",
    matched_response: "pending",
    plan: suggestPlan({
      aEvents: calendars.get(match.userId),
      bEvents: calendars.get(match.matchedUserId),
      aCollege: colleges.get(match.userId),
      bCollege: colleges.get(match.matchedUserId),
      matchType: match.matchType,
      weekStart,
      now,
    }),
  }));

  // Existing pairs stay put, including interest and chat status.
  let includePlan = true;
  for (let index = 0; index < rows.length; index += 500) {
    const slice = rows.slice(index, index + 500);
    let { error: insertError } = await upsertMatches(supabase, slice, includePlan);

    // The plan column arrives with a later migration. Until it has been run,
    // save the matches without a plan instead of failing the whole drop.
    if (insertError && includePlan && isMissingPlanColumn(insertError)) {
      includePlan = false;
      ({ error: insertError } = await upsertMatches(supabase, slice, false));
    }
    if (insertError) throw new Error(insertError.message);
  }

  return { weekStart, considered: people.length, planned: planned.length };
}

type DatabaseError = { message: string; code?: string };

function upsertMatches(supabase: SupabaseClient, rows: MatchInsert[], includePlan: boolean) {
  const payload = includePlan
    ? rows
    : rows.map((row) => {
        const copy = { ...row };
        delete copy.plan;
        return copy;
      });
  return supabase.from("matches").upsert(payload, {
    onConflict: "user_id,matched_user_id,week_start,match_type",
    ignoreDuplicates: true,
  });
}

function isMissingPlanColumn(error: DatabaseError): boolean {
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /\bplan\b/i.test(error.message)
  );
}

/**
 * Imported calendars and colleges for the people who were paired. Calendars
 * are private, so this needs the service-role client. If either table cannot
 * be read (the migration has not been run yet), matches go out without plans.
 */
async function loadPlanInputs(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<{ calendars: Map<string, CalendarEvent[]>; colleges: Map<string, string> }> {
  const calendars = new Map<string, CalendarEvent[]>();
  const colleges = new Map<string, string>();

  for (let index = 0; index < userIds.length; index += 200) {
    const ids = userIds.slice(index, index + 200);

    const { data: calendarRows, error: calendarError } = await supabase
      .from("calendars")
      .select("user_id, events")
      .in("user_id", ids);
    if (calendarError) return { calendars: new Map(), colleges };
    for (const row of (calendarRows ?? []) as { user_id: string; events: unknown }[]) {
      calendars.set(row.user_id, normalizeEvents(row.events));
    }

    const { data: userRows, error: userError } = await supabase
      .from("users")
      .select("id, college")
      .in("id", ids);
    if (!userError) {
      for (const row of (userRows ?? []) as { id: string; college: string }[]) {
        colleges.set(row.id, row.college);
      }
    }
  }

  return { calendars, colleges };
}

type ScoredPair = PlannedMatch & { key: string };

function pairPeople(
  people: MatchCandidate[],
  scorePair: (
    left: MatchCandidate,
    right: MatchCandidate,
  ) => { score: number; whyMatched: string; matchType: MatchType },
): ScoredPair[] {
  const pairs: ScoredPair[] = [];
  const ordered = [...people].sort((a, b) => a.userId.localeCompare(b.userId));
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const left = ordered[i];
      const right = ordered[j];
      if (left.userId.toLowerCase() === right.userId.toLowerCase()) continue;
      const scored = scorePair(left, right);
      const [userId, matchedUserId] = canonicalPair(left.userId, right.userId);
      pairs.push({
        ...scored,
        score: clampScore(scored.score),
        userId,
        matchedUserId,
        key: `${scored.matchType}:${userId}:${matchedUserId}`,
      });
    }
  }
  pairs.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return pairs;
}

function takePairs(
  pairs: ScoredPair[],
  cap: number,
  load: Map<string, number>,
  seen: Set<string>,
  chosen: PlannedMatch[],
) {
  for (const pair of pairs) {
    if (seen.has(pair.key)) continue;
    if ((load.get(pair.userId) ?? 0) >= cap) continue;
    if ((load.get(pair.matchedUserId) ?? 0) >= cap) continue;
    seen.add(pair.key);
    load.set(pair.userId, (load.get(pair.userId) ?? 0) + 1);
    load.set(pair.matchedUserId, (load.get(pair.matchedUserId) ?? 0) + 1);
    chosen.push({
      userId: pair.userId,
      matchedUserId: pair.matchedUserId,
      matchType: pair.matchType,
      score: pair.score,
      whyMatched: pair.whyMatched,
    });
  }
}

function bestPartner(
  people: MatchCandidate[],
  person: MatchCandidate,
  scorePair: (left: MatchCandidate, right: MatchCandidate) => number,
): { other: MatchCandidate; score: number } | null {
  let best: { other: MatchCandidate; score: number } | null = null;
  for (const other of people) {
    if (other.userId === person.userId) continue;
    const score = scorePair(person, other);
    if (!best || score > best.score) best = { other, score };
  }
  return best;
}

/** Matches the SQL check: user_id::text < matched_user_id::text. */
export function canonicalPair(a: string, b: string): [string, string] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

function jaccard(left: string[], right: string[]): number {
  const a = new Set(left.map((item) => item.toLowerCase()).filter(Boolean));
  const b = new Set(right.map((item) => item.toLowerCase()).filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  return overlap / (a.size + b.size - overlap);
}

function shared(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((item) => item.toLowerCase()));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of left) {
    const key = item.toLowerCase();
    if (!rightSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function courseTokens(text: string): string[] {
  const matches = text.toUpperCase().match(/\b[A-Z]{2,5}\s?\d{3}[A-Z]?\b/g) ?? [];
  return Array.from(new Set(matches.map((token) => token.replace(/\s+/g, ""))));
}

function prettyCourse(token: string): string {
  return token.replace(/([A-Z]+)(\d+)/, "$1 $2");
}

function humanJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function sentence(parts: string[], fallback: string): string {
  const chosen = parts.filter(Boolean).slice(0, 2);
  if (chosen.length === 0) return fallback;
  const body = chosen.join(", and ");
  return `${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
}

function clip(text: string): string {
  if (text.length <= 280) return text;
  return `${text.slice(0, 279).trimEnd()}…`;
}

function clampScore(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Math.max(0, Math.min(100, rounded));
}
