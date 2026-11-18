/** Keep this list identical to the check constraint in supabase/schema.sql. */
export const COLLEGES = [
  "Benjamin Franklin",
  "Berkeley",
  "Branford",
  "Davenport",
  "Ezra Stiles",
  "Grace Hopper",
  "Jonathan Edwards",
  "Morse",
  "Pauli Murray",
  "Pierson",
  "Saybrook",
  "Silliman",
  "Timothy Dwight",
  "Trumbull",
] as const;

export type College = (typeof COLLEGES)[number];

/** Graduation year. Widen this list each fall; the database allows 2020–2040. */
export const CLASS_YEARS = [2026, 2027, 2028, 2029, 2030, 2031] as const;

export const SOCIAL_ENERGY = [
  {
    value: "low",
    label: "Low-key",
    hint: "I'd rather talk to one person than work a room.",
  },
  {
    value: "medium",
    label: "In the middle",
    hint: "A few people is my sweet spot. I might leave early.",
  },
  {
    value: "high",
    label: "High energy",
    hint: "The more people the better.",
  },
] as const;

export const GROUP_SIZES = [
  { value: "one-on-one", label: "One-on-one" },
  { value: "small", label: "Small group" },
  { value: "large", label: "Big group" },
  { value: "mix", label: "A mix" },
] as const;

export const INTERESTS = [
  "Live music",
  "Club sports",
  "Hiking",
  "Cooking",
  "Film",
  "Reading",
  "Visual art",
  "Theater",
  "Coffee",
  "Museums",
  "Board games",
  "Running",
  "Dance",
  "Volunteering",
  "Photography",
  "New Haven food",
  "Trivia",
  "Gaming",
] as const;

export const SLEEP_OPTIONS = [
  { value: "early", label: "Early" },
  { value: "flexible", label: "Flexible" },
  { value: "night", label: "Night owl" },
] as const;

export const WEEKEND_OPTIONS = [
  { value: "chill", label: "Stay in" },
  { value: "mix", label: "Some of both" },
  { value: "out", label: "Go out" },
] as const;

export const DINING_OPTIONS = [
  { value: "cooking", label: "Cooking" },
  { value: "dining-hall", label: "Dining hall" },
  { value: "eating-out", label: "Eating out" },
] as const;

export const LOOKING_FOR = [
  "a meal buddy",
  "someone to explore New Haven with",
  "low-key hangs",
  "a go-out friend",
  "a creative collaborator",
  "coffee and a long talk",
  "weekend plans",
  "getting off campus",
] as const;

export const STUDY_SUBJECTS = [
  "Computer Science",
  "Economics",
  "Biology",
  "Chemistry",
  "Physics",
  "Mathematics",
  "Political Science",
  "History",
  "English",
  "Psychology",
  "Engineering",
  "Statistics & Data Science",
  "Global Affairs",
  "Philosophy",
  "Pre-med",
] as const;

export const STUDY_STYLES = [
  { value: "silent", label: "Silent, side by side" },
  { value: "collaborative", label: "Talk it through" },
  { value: "pomodoro", label: "Pomodoro" },
  { value: "teach-back", label: "Teach it back" },
] as const;

export const STUDY_AVAILABILITY = [
  "Weekday mornings",
  "Weekday afternoons",
  "Weekday evenings",
  "Weekends",
] as const;

export const STUDY_GOALS = [
  { value: "accountability", label: "Accountability" },
  { value: "problem-sets", label: "Problem sets" },
  { value: "exam-prep", label: "Exam prep" },
  { value: "reading", label: "Getting through the reading" },
] as const;

export const YALE_EMAIL = /^[^@\s]+@yale\.edu$/i;

export function isYaleEmail(email: string): boolean {
  return YALE_EMAIL.test(email.trim());
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
