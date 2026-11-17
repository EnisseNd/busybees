import type {
  DINING_OPTIONS,
  GROUP_SIZES,
  SLEEP_OPTIONS,
  SOCIAL_ENERGY,
  STUDY_GOALS,
  STUDY_STYLES,
  WEEKEND_OPTIONS,
} from "@/lib/constants";

export type SocialEnergy = (typeof SOCIAL_ENERGY)[number]["value"];
export type GroupSize = (typeof GROUP_SIZES)[number]["value"];
export type SleepSchedule = (typeof SLEEP_OPTIONS)[number]["value"];
export type WeekendStyle = (typeof WEEKEND_OPTIONS)[number]["value"];
export type DiningStyle = (typeof DINING_OPTIONS)[number]["value"];
export type StudyStyle = (typeof STUDY_STYLES)[number]["value"];
export type StudyGoal = (typeof STUDY_GOALS)[number]["value"];

export type MatchType = "friend" | "study";
export type MatchStatus = "pending" | "mutual" | "closed";
export type MatchResponse = "pending" | "interested" | "passed";

/** Scored friend answers. Prompts are stored and kept private. */
export type FriendAnswers = {
  socialEnergy: SocialEnergy;
  groupSize: GroupSize;
  interests: string[];
  lifestyle: {
    sleep: SleepSchedule;
    weekend: WeekendStyle;
    dining: DiningStyle;
  };
  lookingFor: string[];
  prompts: {
    perfectSunday: string;
    yaleHotTake: string;
    showMe: string;
  };
};

export type StudyAnswers = {
  subjects: string[];
  studyStyle: StudyStyle;
  availability: string[];
  courses: string;
  goal: StudyGoal;
};

export type StoredAnswers = {
  friend: FriendAnswers;
  study?: StudyAnswers;
};

/** Wizard state. Empty strings mean "not chosen yet". */
export type QuestionnaireDraft = {
  friend: {
    socialEnergy: "" | SocialEnergy;
    groupSize: "" | GroupSize;
    interests: string[];
    lifestyle: {
      sleep: "" | SleepSchedule;
      weekend: "" | WeekendStyle;
      dining: "" | DiningStyle;
    };
    lookingFor: string[];
    prompts: {
      perfectSunday: string;
      yaleHotTake: string;
      showMe: string;
    };
  };
  studyOptIn: boolean;
  study: {
    subjects: string[];
    studyStyle: "" | StudyStyle;
    availability: string[];
    courses: string;
    goal: "" | StudyGoal;
  };
};

export type Profile = {
  id: string;
  email: string;
  college: string;
  classYear: number;
  createdAt: string;
  /** True when auth succeeded but the profile row is missing. */
  needsProfile: boolean;
};

/** One of the five things on a lunch-tray profile. */
export type TrayItem = {
  label: string;
  emoji: string;
  /** Small data URL of an uploaded photo. Empty or missing means show the emoji. */
  image?: string | null;
};

/** A busy block from an imported calendar. Times are minutes after midnight in New Haven. */
export type CalendarEvent = {
  date: string;
  start: number;
  end: number;
  title: string;
};

/** The suggested meetup stored on a match. */
export type MatchPlan = {
  /** YYYY-MM-DD */
  date: string;
  /** Hour the meetup starts, 0-23, New Haven time. */
  hour: number;
  /** "Lunch", "Coffee", "Study session"... */
  activity: string;
  place: string;
};

export type MatchCardModel = {
  id: string;
  matchType: MatchType;
  weekStart: string;
  score: number;
  whyMatched: string;
  status: MatchStatus;
  viewerResponse: MatchResponse;
  partnerResponse: MatchResponse;
  plan: MatchPlan | null;
  partner: {
    id: string;
    firstName: string;
    college: string;
    classYear: number;
    tray: TrayItem[];
  };
};

export type ChatMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

export type AuthFormState = {
  message: string;
  tone: "idle" | "ok" | "error";
};
