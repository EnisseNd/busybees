import {
  DINING_OPTIONS,
  GROUP_SIZES,
  INTERESTS,
  LOOKING_FOR,
  SLEEP_OPTIONS,
  SOCIAL_ENERGY,
  STUDY_AVAILABILITY,
  STUDY_GOALS,
  STUDY_STYLES,
  STUDY_SUBJECTS,
  WEEKEND_OPTIONS,
} from "@/lib/constants";
import type {
  FriendAnswers,
  QuestionnaireDraft,
  StoredAnswers,
  StudyAnswers,
} from "@/lib/types";

const PROMPT_MIN = 10;
const PROMPT_MAX = 280;



export function emptyDraft(): QuestionnaireDraft {
  return {
    friend: {
      socialEnergy: "",
      groupSize: "",
      interests: [],
      lifestyle: { sleep: "", weekend: "", dining: "" },
      lookingFor: [],
      prompts: { perfectSunday: "", yaleHotTake: "", showMe: "" },
    },
    studyOptIn: false,
    study: {
      subjects: [],
      studyStyle: "",
      availability: [],
      courses: "",
      goal: "",
    },
  };
}

export function draftFromStored(
  answers: unknown,
  lookingForStudyBuddy: boolean,
): QuestionnaireDraft {
  const draft = emptyDraft();
  const stored = parseStoredAnswers(answers);
  if (!stored) return draft;

  draft.friend = stored.friend;
  if (lookingForStudyBuddy && stored.study) {
    draft.studyOptIn = true;
    draft.study = stored.study;
  }
  return draft;
}

export function parseStoredAnswers(value: unknown): StoredAnswers | null {
  const validated = validateQuestionnaire(value);
  if (!validated.ok) return null;
  return validated.answers;
}

export function validateStep(
  draft: QuestionnaireDraft,
  step: number,
): string | null {
  if (step === 0) {
    if (!draft.friend.socialEnergy) return "Choose a social energy.";
    if (!draft.friend.groupSize) return "Choose a usual group size.";
    return null;
  }
  if (step === 1) {
    if (draft.friend.interests.length < 3) return "Pick at least 3 interests.";
    return null;
  }
  if (step === 2) {
    const { sleep, weekend, dining } = draft.friend.lifestyle;
    if (!sleep || !weekend || !dining) return "Answer all three lifestyle questions.";
    return null;
  }
  if (step === 3) {
    if (draft.friend.lookingFor.length < 1) {
      return "Pick at least one thing you're looking for.";
    }
    return null;
  }
  if (step === 4) {
    return promptError(draft.friend.prompts);
  }
  if (step === 5) {
    if (!draft.studyOptIn) return null;
    return studyError(draft);
  }
  return null;
}

export function validateQuestionnaire(
  input: unknown,
):
  | { ok: true; answers: StoredAnswers; lookingForStudyBuddy: boolean }
  | { ok: false; message: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "The questionnaire could not be read." };
  }

  const source = input as QuestionnaireDraft & { friend?: unknown; study?: unknown };
  // Accept either a wizard draft or an already-stored { friend, study } blob.
  const friendSource =
    source.friend && typeof source.friend === "object" ? source.friend : null;
  if (!friendSource) {
    return { ok: false, message: "Friend answers are missing." };
  }

  const friend = readFriend(friendSource as QuestionnaireDraft["friend"]);
  if (!friend.ok) return friend;

  // Wizard drafts carry studyOptIn. Stored JSON carries a study object only when
  // the student opted in. The matches job still trusts the boolean column.
  const wantsStudy =
    "studyOptIn" in (input as object)
      ? Boolean((input as QuestionnaireDraft).studyOptIn)
      : Boolean(source.study);

  if (!wantsStudy) {
    return {
      ok: true,
      answers: { friend: friend.value },
      lookingForStudyBuddy: false,
    };
  }

  const studySource = (input as QuestionnaireDraft).study ?? source.study;
  const study = readStudy(studySource);
  if (!study.ok) return study;

  return {
    ok: true,
    answers: { friend: friend.value, study: study.value },
    lookingForStudyBuddy: true,
  };
}

function readFriend(
  friend: QuestionnaireDraft["friend"],
): { ok: true; value: FriendAnswers } | { ok: false; message: string } {
  if (!isValue(friend.socialEnergy, SOCIAL_ENERGY)) {
    return { ok: false, message: "Choose a social energy." };
  }
  if (!isValue(friend.groupSize, GROUP_SIZES)) {
    return { ok: false, message: "Choose a usual group size." };
  }

  const interests = allowedList(friend.interests, INTERESTS);
  if (interests.length < 3) return { ok: false, message: "Pick at least 3 interests." };

  if (
    !isValue(friend.lifestyle?.sleep, SLEEP_OPTIONS) ||
    !isValue(friend.lifestyle?.weekend, WEEKEND_OPTIONS) ||
    !isValue(friend.lifestyle?.dining, DINING_OPTIONS)
  ) {
    return { ok: false, message: "Answer all three lifestyle questions." };
  }

  const lookingFor = allowedList(friend.lookingFor, LOOKING_FOR);
  if (lookingFor.length < 1) {
    return { ok: false, message: "Pick at least one thing you're looking for." };
  }

  const promptProblem = promptError(friend.prompts);
  if (promptProblem) return { ok: false, message: promptProblem };

  return {
    ok: true,
    value: {
      socialEnergy: friend.socialEnergy,
      groupSize: friend.groupSize,
      interests,
      lifestyle: {
        sleep: friend.lifestyle.sleep,
        weekend: friend.lifestyle.weekend,
        dining: friend.lifestyle.dining,
      },
      lookingFor,
      prompts: {
        perfectSunday: cleanText(friend.prompts.perfectSunday, PROMPT_MAX) ?? "",
        yaleHotTake: cleanText(friend.prompts.yaleHotTake, PROMPT_MAX) ?? "",
        showMe: cleanText(friend.prompts.showMe, PROMPT_MAX) ?? "",
      },
    },
  };
}

function readStudy(
  study: unknown,
): { ok: true; value: StudyAnswers } | { ok: false; message: string } {
  if (!study || typeof study !== "object") {
    return { ok: false, message: "Add your study-buddy answers, or leave that section off." };
  }
  const draft = study as QuestionnaireDraft["study"];
  const problem = studyError({ studyOptIn: true, study: draft } as QuestionnaireDraft);
  if (problem) return { ok: false, message: problem };

  return {
    ok: true,
    value: {
      subjects: allowedList(draft.subjects, STUDY_SUBJECTS),
      studyStyle: draft.studyStyle as StudyAnswers["studyStyle"],
      availability: allowedList(draft.availability, STUDY_AVAILABILITY),
      courses: cleanText(draft.courses, 160) ?? "",
      goal: draft.goal as StudyAnswers["goal"],
    },
  };
}

function studyError(draft: QuestionnaireDraft): string | null {
  if (allowedList(draft.study.subjects, STUDY_SUBJECTS).length < 1) {
    return "Pick at least one subject.";
  }
  if (!isValue(draft.study.studyStyle, STUDY_STYLES)) {
    return "Choose a study style.";
  }
  if (allowedList(draft.study.availability, STUDY_AVAILABILITY).length < 1) {
    return "Pick at least one time you're free to study.";
  }
  if (!isValue(draft.study.goal, STUDY_GOALS)) {
    return "Choose a study goal.";
  }
  return null;
}

function promptError(prompts: QuestionnaireDraft["friend"]["prompts"] | undefined): string | null {
  if (!prompts) return "Answer the three prompts.";
  const fields: Array<[string, string]> = [
    ["perfect Sunday", prompts.perfectSunday],
    ["Yale opinion", prompts.yaleHotTake],
    ["thing you'd show someone", prompts.showMe],
  ];
  for (const [label, value] of fields) {
    const text = cleanText(value, PROMPT_MAX);
    if (!text || text.length < PROMPT_MIN) {
      return `Write a little more about your ${label} (at least ${PROMPT_MIN} characters).`;
    }
  }
  return null;
}

function isValue<T extends string>(
  value: unknown,
  options: readonly { value: T }[],
): value is T {
  return typeof value === "string" && options.some((option) => option.value === value);
}

function allowedList(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  const permitted = new Set<string>(allowed);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !permitted.has(item) || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, max);
}
