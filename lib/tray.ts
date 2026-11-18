import type { MatchPlan, TrayItem } from "@/lib/types";

export const TRAY_SLOTS = 5;
export const TRAY_LABEL_MAX = 24;
export const TRAY_EMOJI_MAX = 8;
/** Longest photo data URL we store. About 65 KB of JPEG. */
export const TRAY_IMAGE_MAX = 90_000;
export const FIRST_NAME_MAX = 40;

/** Names for the five wells, in the order the tray draws them. */
export const SLOT_NAMES = [
  "Top left",
  "Top middle",
  "Top right",
  "Your drink",
  "The big one",
] as const;

/** The round bottom-left well is the drink. */
export const DRINK_SLOT = 3;

/** Top-view drink photos that ship with the app under public/collage. */
export const DRINK_PRESETS = [
  { label: "Matcha", image: "/collage/drink-matcha.webp" },
  { label: "Iced coffee", image: "/collage/drink-coffee.webp" },
  { label: "Tea", image: "/collage/drink-tea.webp" },
] as const;

/** Ready-made cut-outs anyone can drop into a well instead of an emoji. */
export const STICKERS = [
  { label: "Movies", image: "/collage/thing-clapper.webp" },
  { label: "Scarf", image: "/collage/thing-scarf.webp" },
  { label: "Skirt", image: "/collage/thing-skirt.webp" },
  { label: "Sneakers", image: "/collage/thing-sneakers.webp" },
  { label: "Sunflowers", image: "/collage/thing-sunflowers.webp" },
  { label: "Lilies", image: "/collage/thing-lily.webp" },
] as const;

/** A well can pile up to this many extra cut-outs on top of its main picture. */
export const TRAY_EXTRAS_MAX = 2;

/** Any picture that ships with the app under public/collage. */
export function isPresetImage(value: unknown): value is string {
  return typeof value === "string" && /^\/collage\/[a-z0-9-]+\.webp$/.test(value);
}

function cleanExtras(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPresetImage).slice(0, TRAY_EXTRAS_MAX);
}

export const QUICK_EMOJI = [
  "🍵",
  "🌻",
  "🎬",
  "🎧",
  "📚",
  "🥾",
  "🧶",
  "🍜",
  "🎸",
  "🧁",
  "📷",
  "🏀",
] as const;

export type TrayDraft = {
  firstName: string;
  items: TrayItem[];
};

export function emptyItem(): TrayItem {
  return { label: "", emoji: "", image: null };
}

export function emptyTray(): TrayItem[] {
  return Array.from({ length: TRAY_SLOTS }, emptyItem);
}

function emojiLength(value: string): number {
  return Array.from(value).length;
}

/** An uploaded photo (small data URL) or one of the built-in drink photos. */
function isPhoto(value: unknown): value is string {
  if (isPresetImage(value)) return true;
  return (
    typeof value === "string" &&
    value.length <= TRAY_IMAGE_MAX &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
  );
}

/** Reads whatever is stored in users.tray and returns exactly five slots. */
export function parseTray(value: unknown): TrayItem[] {
  const tray = emptyTray();
  if (!Array.isArray(value)) return tray;

  value.slice(0, TRAY_SLOTS).forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const item = raw as Record<string, unknown>;
    tray[index] = {
      label: typeof item.label === "string" ? item.label.slice(0, TRAY_LABEL_MAX) : "",
      emoji: typeof item.emoji === "string" ? item.emoji.slice(0, 32) : "",
      image: isPhoto(item.image) ? item.image : null,
      extras: cleanExtras(item.extras),
    };
  });

  return tray;
}

export function slotIsFilled(item: TrayItem | null | undefined): boolean {
  return Boolean(item && (item.image || item.emoji.trim() || item.label.trim()));
}

export function trayIsEmpty(tray: TrayItem[]): boolean {
  return !tray.some(slotIsFilled);
}

export function validateTray(
  input: unknown,
): { ok: true; firstName: string; tray: TrayItem[] } | { ok: false; message: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "That tray did not come through. Try saving again." };
  }

  const draft = input as { firstName?: unknown; items?: unknown };
  const firstName = typeof draft.firstName === "string" ? draft.firstName.trim() : "";
  if (!firstName) return { ok: false, message: "Add your first name." };
  if (firstName.length > FIRST_NAME_MAX) {
    return { ok: false, message: `Keep your first name under ${FIRST_NAME_MAX} characters.` };
  }

  if (!Array.isArray(draft.items) || draft.items.length > TRAY_SLOTS) {
    return { ok: false, message: "A tray holds five things." };
  }

  const tray = emptyTray();
  for (let index = 0; index < draft.items.length; index += 1) {
    const raw = draft.items[index];
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const emoji = typeof item.emoji === "string" ? item.emoji.trim() : "";
    const image = item.image;
    const where = SLOT_NAMES[index].toLowerCase();

    if (label.length > TRAY_LABEL_MAX) {
      return { ok: false, message: `The ${where} label is over ${TRAY_LABEL_MAX} characters.` };
    }
    if (emojiLength(emoji) > TRAY_EMOJI_MAX || emoji.length > 32) {
      return { ok: false, message: `Use one or two emoji for ${where}.` };
    }
    if (image !== null && image !== undefined && image !== "" && !isPhoto(image)) {
      return {
        ok: false,
        message: `The ${where} photo is too big or not an image. Try a different one.`,
      };
    }

    const main = isPhoto(image) ? image : null;
    tray[index] = { label, emoji, image: main, extras: main ? cleanExtras(item.extras) : [] };
  }

  if (trayIsEmpty(tray)) {
    return { ok: false, message: "Put at least one thing on your tray." };
  }

  for (let index = 0; index < tray.length; index += 1) {
    const item = tray[index];
    if (item.label && !item.emoji && !item.image) {
      return {
        ok: false,
        message: `Pick an emoji or a photo for "${item.label}".`,
      };
    }
  }

  return { ok: true, firstName, tray };
}

export function parsePlan(value: unknown): MatchPlan | null {
  if (!value || typeof value !== "object") return null;
  const plan = value as Record<string, unknown>;
  if (
    typeof plan.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(plan.date) ||
    typeof plan.hour !== "number" ||
    plan.hour < 0 ||
    plan.hour > 23 ||
    typeof plan.activity !== "string" ||
    typeof plan.place !== "string" ||
    !plan.activity ||
    !plan.place
  ) {
    return null;
  }
  return {
    date: plan.date,
    hour: Math.floor(plan.hour),
    activity: plan.activity,
    place: plan.place,
  };
}

function hourPhrase(hour: number): string {
  if (hour === 12) return "noon";
  if (hour === 0) return "midnight";
  return hour > 12 ? `${hour - 12} pm` : `${hour} am`;
}

/** "Lunch Thursday at noon, Saybrook dining hall" */
export function planLine(plan: MatchPlan): string {
  const [year, month, day] = plan.date.split("-").map(Number);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
  return `${plan.activity} ${weekday} at ${hourPhrase(plan.hour)}, ${plan.place}`;
}

/** What to call a match on screen when they have not added a first name. */
export function partnerName(firstName: string, college: string): string {
  const name = firstName.trim();
  if (name) return name;
  return college ? `Someone in ${college}` : "Someone at Yale";
}

export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}
