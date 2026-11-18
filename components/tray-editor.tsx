"use client";

import { useRef, useState, useTransition } from "react";
import { saveTray } from "@/app/actions/tray";
import { Scrap } from "@/components/scrap";
import { Tray } from "@/components/tray";
import { fieldClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/lib/styles";
import {
  DRINK_PRESETS,
  DRINK_SLOT,
  FIRST_NAME_MAX,
  QUICK_EMOJI,
  STICKERS,
  TRAY_EXTRAS_MAX,
  SLOT_NAMES,
  TRAY_IMAGE_MAX,
  TRAY_LABEL_MAX,
  isPresetImage,
  possessive,
  validateTray,
} from "@/lib/tray";
import type { TrayItem } from "@/lib/types";

const PLACEHOLDERS = ["Sunflowers", "Film nights", "East Rock", "Matcha", "My playlist"];

/** Shrinks a photo in the browser so it fits in the tray column. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("unreadable"));
      element.src = url;
    });

    const attempts: [number, number][] = [
      [320, 0.82],
      [320, 0.62],
      [240, 0.62],
      [200, 0.5],
    ];
    for (const [longSide, quality] of attempts) {
      const scale = Math.min(1, longSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("unreadable");
      // JPEG has no transparency, so cut-outs get a white backing.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= TRAY_IMAGE_MAX) return data;
    }
    throw new Error("too-big");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function TrayEditor({
  initialFirstName,
  initialItems,
  college,
  onSave,
}: {
  initialFirstName: string;
  initialItems: TrayItem[];
  college: string;
  /** Replaces the server action. The sample-data demo uses this. */
  onSave?: (draft: { firstName: string; items: TrayItem[] }) => void;
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [items, setItems] = useState<TrayItem[]>(initialItems);
  const [active, setActive] = useState(0);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState<{ slot: number; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function update(index: number, patch: Partial<TrayItem>) {
    setItems((current) =>
      current.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    );
  }

  async function addPhoto(index: number, file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith("image/")) {
      setPhotoError({ slot: index, message: "That file isn't a picture." });
      return;
    }
    try {
      update(index, { image: await shrinkPhoto(file) });
    } catch (problem) {
      setPhotoError({
        slot: index,
        message:
          problem instanceof Error && problem.message === "too-big"
            ? "That photo is still too big after shrinking. Try a simpler one."
            : "That photo couldn't be opened. Try a JPG or PNG.",
      });
    }
  }

  function submit() {
    const draft = { firstName, items };
    const checked = validateTray(draft);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    setError("");
    if (onSave) {
      onSave({ firstName: checked.firstName, items: checked.tray });
      return;
    }
    startTransition(async () => {
      const result = await saveTray(draft);
      if (result) setError(result.message);
    });
  }

  const shownName = firstName.trim();

  return (
    <div className="tray-editor">
      <section aria-label="Preview" className="tray-editor-preview bg-desk">
        <span aria-hidden="true" className="tape" style={{ top: "-0.6rem", left: "2rem" }} />
        <div className="text-center">
          <Scrap shape={2} tilt={-3}>
            <span className="font-serif text-2xl leading-tight ink-rose sm:text-3xl">
              {shownName ? `${possessive(shownName)} tray` : "Your tray"}
            </span>
          </Scrap>
        </div>
        <div className="mt-6">
          <Tray items={items} />
        </div>
        <p className="mt-8 text-center">
          <Scrap shape={1} tilt={2} white>
            <span className="text-sm font-extrabold ink-leaf">This is the card your matches get</span>
          </Scrap>
        </p>
      </section>

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="panel p-5">
          <label className="block">
            <span className={labelClass}>First name</span>
            <input
              autoComplete="given-name"
              className={fieldClass}
              maxLength={FIRST_NAME_MAX}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="What people call you"
              value={firstName}
            />
          </label>
          {college ? (
            <p className="mt-2 text-sm text-muted">
              {college} shows up next to it, so there&rsquo;s no need to add it.
            </p>
          ) : null}
        </div>

        {items.map((item, index) => (
          <SlotFields
            active={active === index}
            index={index}
            item={item}
            key={index}
            onFocus={() => setActive(index)}
            onPhoto={(file) => addPhoto(index, file)}
            onUpdate={(patch) => update(index, patch)}
            photoError={photoError?.slot === index ? photoError.message : ""}
          />
        ))}

        {error ? (
          <p className="border-2 border-alert bg-white px-4 py-3 text-sm font-bold text-alert" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button className={primaryButtonClass} disabled={pending} type="submit">
            {pending ? "Saving…" : "Save my tray"}
          </button>
          <p className="text-sm text-muted">You can change it whenever you want.</p>
        </div>
      </form>
    </div>
  );
}

function SlotFields({
  index,
  item,
  active,
  photoError,
  onFocus,
  onUpdate,
  onPhoto,
}: {
  index: number;
  item: TrayItem;
  active: boolean;
  photoError: string;
  onFocus: () => void;
  onUpdate: (patch: Partial<TrayItem>) => void;
  onPhoto: (file: File | undefined) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const isDrink = index === DRINK_SLOT;
  const hasUpload = Boolean(item.image) && !isPresetImage(item.image);

  return (
    <fieldset className={`panel tray-slot p-5 ${active ? "tray-slot-active" : ""}`} onFocus={onFocus}>
      <legend className="float-left mb-3 w-full text-base font-black text-ink">
        {SLOT_NAMES[index]}
      </legend>

      {isDrink ? (
        <div className="clear-both mb-4">
          <p className="mb-2 text-sm text-muted">Pick one, or skip these and add your own below.</p>
          <div className="flex flex-wrap gap-2">
            {DRINK_PRESETS.map((drink) => {
              const chosen = item.image === drink.image;
              return (
                <button
                  aria-pressed={chosen}
                  className={`drink-choice ${chosen ? "drink-choice-on" : ""}`}
                  key={drink.image}
                  onClick={() =>
                    onUpdate(
                      chosen
                        ? { image: null }
                        : {
                            image: drink.image,
                            // Keep a label the student typed; replace an old preset name.
                            label:
                              !item.label || DRINK_PRESETS.some((other) => other.label === item.label)
                                ? drink.label
                                : item.label,
                          },
                    )
                  }
                  type="button"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    className="drink-choice-photo"
                    onError={(event) => {
                      event.currentTarget.style.visibility = "hidden";
                    }}
                    src={drink.image}
                  />
                  {drink.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="clear-both grid grid-cols-[1fr_5.5rem] gap-3">
        <label className="block">
          <span className={labelClass}>Label</span>
          <input
            className={fieldClass}
            maxLength={TRAY_LABEL_MAX}
            onChange={(event) => onUpdate({ label: event.target.value })}
            placeholder={PLACEHOLDERS[index]}
            value={item.label}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Emoji</span>
          <input
            className={`${fieldClass} text-center text-xl`}
            inputMode="text"
            maxLength={32}
            onChange={(event) => onUpdate({ emoji: event.target.value })}
            placeholder="+"
            value={item.emoji}
          />
        </label>
      </div>

      {active ? (
        <div aria-label="Quick emoji" className="mt-3 flex flex-wrap gap-1.5" role="group">
          {QUICK_EMOJI.map((emoji) => (
            <button
              aria-label={`Use ${emoji}`}
              className="quick-emoji"
              key={emoji}
              onClick={() => onUpdate({ emoji })}
              type="button"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      {active && !isDrink ? (
        <div className="mt-3">
          <p className="mb-2 text-sm text-muted">Or use a cut-out. Tap a second one to pile it on.</p>
          <div className="flex flex-wrap gap-2">
            {STICKERS.map((sticker) => {
              const extras = item.extras ?? [];
              const isMain = item.image === sticker.image;
              const isExtra = extras.includes(sticker.image);
              return (
                <button
                  aria-pressed={isMain || isExtra}
                  className={`drink-choice ${isMain || isExtra ? "drink-choice-on" : ""}`}
                  key={sticker.image}
                  onClick={() => {
                    if (isMain) {
                      // Taking the main picture off promotes the first extra, if any.
                      onUpdate({ image: extras[0] ?? null, extras: extras.slice(1) });
                    } else if (isExtra) {
                      onUpdate({ extras: extras.filter((src) => src !== sticker.image) });
                    } else if (!item.image) {
                      onUpdate({ image: sticker.image, label: item.label || sticker.label });
                    } else if (extras.length < TRAY_EXTRAS_MAX) {
                      onUpdate({ extras: [...extras, sticker.image] });
                    }
                  }}
                  type="button"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="drink-choice-photo" src={sticker.image} />
                  {sticker.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            onPhoto(event.target.files?.[0]);
            event.target.value = "";
          }}
          ref={fileInput}
          tabIndex={-1}
          type="file"
        />
        <button
          className={`${secondaryButtonClass} px-4 py-2`}
          onClick={() => fileInput.current?.click()}
          type="button"
        >
          {hasUpload ? "Change photo" : "Use a photo instead"}
        </button>
        {hasUpload ? (
          <button
            className="px-3 py-2 text-sm font-extrabold text-rose underline"
            onClick={() => onUpdate({ image: null })}
            type="button"
          >
            Remove photo
          </button>
        ) : null}
        {hasUpload ? (
          <span className="text-sm text-muted">The photo shows in place of the emoji.</span>
        ) : null}
      </div>
      {photoError ? (
        <p className="mt-2 text-sm font-bold text-alert" role="alert">
          {photoError}
        </p>
      ) : null}
    </fieldset>
  );
}
