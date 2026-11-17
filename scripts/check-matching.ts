import { explainFriendMatch, planWeeklyMatches, scoreFriendMatch, scoreStudyMatch } from "../lib/matching";
import type { FriendAnswers, StudyAnswers } from "../lib/types";

const prompts = {
  perfectSunday: "Coffee, a long walk, and one museum room.",
  yaleHotTake: "The best dining hall breakfast is the quiet one.",
  showMe: "A bookstore corner I keep going back to.",
};

function friend(overrides: Partial<FriendAnswers> = {}): FriendAnswers {
  return {
    socialEnergy: "low",
    groupSize: "one-on-one",
    interests: ["Live music", "Cooking", "Trivia"],
    lifestyle: { sleep: "early", weekend: "chill", dining: "dining-hall" },
    lookingFor: ["a meal buddy", "low-key hangs"],
    prompts,
    ...overrides,
  };
}

function study(overrides: Partial<StudyAnswers> = {}): StudyAnswers {
  return {
    subjects: ["Biology"],
    studyStyle: "silent",
    availability: ["Weekday evenings"],
    courses: "MCDB 202",
    goal: "exam-prep",
    ...overrides,
  };
}

const failures: string[] = [];

function check(label: string, condition: boolean) {
  if (!condition) failures.push(label);
}

const same = friend();
const close = friend({ interests: ["Live music", "Film", "Trivia"] });
const far = friend({
  socialEnergy: "high",
  groupSize: "large",
  interests: ["Club sports"],
  lifestyle: { sleep: "night", weekend: "out", dining: "eating-out" },
  lookingFor: ["a go-out friend"],
});

const identical = scoreFriendMatch(same, same);
const near = scoreFriendMatch(same, close);
const distant = scoreFriendMatch(same, far);

check("identical friends score 100", identical === 100);
check("near score beats distant score", near > distant);
check("scores stay in range", [identical, near, distant].every((score) => score >= 0 && score <= 100));
check("explanation is a sentence", explainFriendMatch(same, close).endsWith("."));

const studySame = scoreStudyMatch(study(), study());
const studyDifferent = scoreStudyMatch(
  study(),
  study({
    subjects: ["History"],
    studyStyle: "collaborative",
    availability: ["Weekends"],
    courses: "HIST 101",
    goal: "reading",
  }),
);
check("identical study score is high", studySame >= 90);
check("different study score is lower", studyDifferent < studySame);

const people = [
  { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", friend: same, study: study(), lookingForStudyBuddy: true },
  { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", friend: close, study: study(), lookingForStudyBuddy: true },
  { userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", friend: far, lookingForStudyBuddy: false },
];

const planned = planWeeklyMatches(people, { minFriendScore: 1, minStudyScore: 1 });
const friendPairs = planned.filter((match) => match.matchType === "friend");
const studyPairs = planned.filter((match) => match.matchType === "study");

check("plans at least one friend match", friendPairs.length >= 1);
check("plans one study match", studyPairs.length === 1);
check(
  "study match skips the person who opted out",
  studyPairs.every((match) => !match.userId.startsWith("ccc") && !match.matchedUserId.startsWith("ccc")),
);
check(
  "pair order matches the database check",
  planned.every((match) => match.userId < match.matchedUserId),
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`matching ok (${planned.length} planned pairs)`);
