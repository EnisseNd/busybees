"use client";

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { saveQuestionnaire } from "@/app/actions/questionnaire";
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
import { validateStep } from "@/lib/questionnaire";
import { fieldClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/lib/styles";
import type { QuestionnaireDraft } from "@/lib/types";

const STEPS = [
  "Social energy",
  "Interests",
  "Lifestyle",
  "What you're looking for",
  "A few prompts",
  "Study buddies",
] as const;

export function QuestionnaireForm({ initialDraft }: { initialDraft: QuestionnaireDraft }) {
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function goNext() {
    const problem = validateStep(draft, step);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function submit() {
    const problem = validateStep(draft, step);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await saveQuestionnaire(draft);
      if (result) setError(result.message);
    });
  }

  return (
    <div>
      <div aria-hidden className="step-squares mb-3">
        {STEPS.map((label, index) => (
          <span data-done={index <= step} key={label} />
        ))}
      </div>
      <p className="text-sm font-semibold text-muted">
        Step {step + 1} of {STEPS.length}
      </p>
      <h2 className="mt-1 font-serif text-2xl text-leaf">{STEPS[step]}</h2>

      <div className="mt-6">
        {step === 0 ? <EnergyStep draft={draft} setDraft={setDraft} /> : null}
        {step === 1 ? <InterestStep draft={draft} setDraft={setDraft} /> : null}
        {step === 2 ? <LifestyleStep draft={draft} setDraft={setDraft} /> : null}
        {step === 3 ? <LookingStep draft={draft} setDraft={setDraft} /> : null}
        {step === 4 ? <PromptStep draft={draft} setDraft={setDraft} /> : null}
        {step === 5 ? <StudyStep draft={draft} setDraft={setDraft} /> : null}
      </div>

      {error ? (
        <p className="mt-4 text-sm font-bold text-alert" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-hairline pt-5">
        <button
          className={secondaryButtonClass}
          disabled={step === 0 || pending}
          onClick={() => {
            setError("");
            setStep((current) => Math.max(current - 1, 0));
          }}
          type="button"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className={primaryButtonClass} onClick={goNext} type="button">
            Continue
          </button>
        ) : (
          <button className={primaryButtonClass} disabled={pending} onClick={submit} type="button">
            {pending ? "Saving…" : "Save my answers"}
          </button>
        )}
      </div>
    </div>
  );
}

function EnergyStep({
  draft,
  setDraft,
}: {
  draft: QuestionnaireDraft;
  setDraft: Dispatch<SetStateAction<QuestionnaireDraft>>;
}) {
  return (
    <div className="grid gap-6">
      <ChoiceGroup
        label="How much social energy do you usually have?"
        onChange={(socialEnergy) =>
          setDraft((current) => ({ ...current, friend: { ...current.friend, socialEnergy } }))
        }
        options={SOCIAL_ENERGY}
        value={draft.friend.socialEnergy}
      />
      <ChoiceGroup
        label="What group size feels right?"
        onChange={(groupSize) =>
          setDraft((current) => ({ ...current, friend: { ...current.friend, groupSize } }))
        }
        options={GROUP_SIZES}
        value={draft.friend.groupSize}
      />
    </div>
  );
}

function InterestStep({
  draft,
  setDraft,
}: {
  draft: QuestionnaireDraft;
  setDraft: Dispatch<SetStateAction<QuestionnaireDraft>>;
}) {
  return (
    <MultiGroup
      hint={`${draft.friend.interests.length} selected. Pick at least 3.`}
      label="What do you like doing?"
      onChange={(interests) =>
        setDraft((current) => ({ ...current, friend: { ...current.friend, interests } }))
      }
      options={INTERESTS}
      values={draft.friend.interests}
    />
  );
}

function LifestyleStep({
  draft,
  setDraft,
}: {
  draft: QuestionnaireDraft;
  setDraft: Dispatch<SetStateAction<QuestionnaireDraft>>;
}) {
  function setLifestyle<K extends keyof QuestionnaireDraft["friend"]["lifestyle"]>(
    key: K,
    value: QuestionnaireDraft["friend"]["lifestyle"][K],
  ) {
    setDraft((current) => ({
      ...current,
      friend: {
        ...current.friend,
        lifestyle: { ...current.friend.lifestyle, [key]: value },
      },
    }));
  }

  return (
    <div className="grid gap-6">
      <ChoiceGroup
        label="Sleep"
        onChange={(sleep) => setLifestyle("sleep", sleep)}
        options={SLEEP_OPTIONS}
        value={draft.friend.lifestyle.sleep}
      />
      <ChoiceGroup
        label="A normal weekend"
        onChange={(weekend) => setLifestyle("weekend", weekend)}
        options={WEEKEND_OPTIONS}
        value={draft.friend.lifestyle.weekend}
      />
      <ChoiceGroup
        label="Eating"
        onChange={(dining) => setLifestyle("dining", dining)}
        options={DINING_OPTIONS}
        value={draft.friend.lifestyle.dining}
      />
    </div>
  );
}

function LookingStep({
  draft,
  setDraft,
}: {
  draft: QuestionnaireDraft;
  setDraft: Dispatch<SetStateAction<QuestionnaireDraft>>;
}) {
  return (
    <MultiGroup
      hint="Pick any that fit."
      label="What are you looking for?"
      onChange={(lookingFor) =>
        setDraft((current) => ({ ...current, friend: { ...current.friend, lookingFor } }))
      }
      options={LOOKING_FOR}
      values={draft.friend.lookingFor}
    />
  );
}

function PromptStep({
  draft,
  setDraft,
}: {
  draft: QuestionnaireDraft;
  setDraft: Dispatch<SetStateAction<QuestionnaireDraft>>;
}) {
  function setPrompt(key: keyof QuestionnaireDraft["friend"]["prompts"], value: string) {
    setDraft((current) => ({
      ...current,
      friend: {
        ...current.friend,
        prompts: { ...current.friend.prompts, [key]: value },
      },
    }));
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm font-semibold leading-6 text-muted">
        Only you see these. Your match gets one line about what you have in common, taken from
        the earlier steps.
      </p>
      <label>
        <span className={labelClass}>A perfect Sunday in New Haven looks like…</span>
        <textarea
          className={fieldClass}
          maxLength={280}
          onChange={(event) => setPrompt("perfectSunday", event.target.value)}
          rows={3}
          value={draft.friend.prompts.perfectSunday}
        />
      </label>
      <label>
        <span className={labelClass}>A small Yale opinion you&apos;ll defend</span>
        <textarea
          className={fieldClass}
          maxLength={280}
          onChange={(event) => setPrompt("yaleHotTake", event.target.value)}
          rows={3}
          value={draft.friend.prompts.yaleHotTake}
        />
      </label>
      <label>
        <span className={labelClass}>Something you&apos;d happily show someone new</span>
        <textarea
          className={fieldClass}
          maxLength={280}
          onChange={(event) => setPrompt("showMe", event.target.value)}
          rows={3}
          value={draft.friend.prompts.showMe}
        />
      </label>
    </div>
  );
}

function StudyStep({
  draft,
  setDraft,
}: {
  draft: QuestionnaireDraft;
  setDraft: Dispatch<SetStateAction<QuestionnaireDraft>>;
}) {
  return (
    <div className="grid gap-6">
      <label className="flex items-start gap-3 rounded-[2px] border-2 border-hairline bg-white px-4 py-3">
        <input
          checked={draft.studyOptIn}
          className="mt-1 h-4 w-4 accent-[var(--leaf)]"
          onChange={(event) =>
            setDraft((current) => ({ ...current, studyOptIn: event.target.checked }))
          }
          type="checkbox"
        />
        <span>
          <span className="block font-extrabold">Match me with a study buddy too</span>
          <span className="mt-1 block text-sm font-semibold text-muted">
            Study buddies come as their own list each week. Leave this off and you only get friend matches.
          </span>
        </span>
      </label>

      {draft.studyOptIn ? (
        <>
          <MultiGroup
            hint="Pick the ones you want company for."
            label="Subjects"
            onChange={(subjects) =>
              setDraft((current) => ({ ...current, study: { ...current.study, subjects } }))
            }
            options={STUDY_SUBJECTS}
            values={draft.study.subjects}
          />
          <ChoiceGroup
            label="How do you like to study?"
            onChange={(studyStyle) =>
              setDraft((current) => ({ ...current, study: { ...current.study, studyStyle } }))
            }
            options={STUDY_STYLES}
            value={draft.study.studyStyle}
          />
          <MultiGroup
            label="When are you free?"
            onChange={(availability) =>
              setDraft((current) => ({ ...current, study: { ...current.study, availability } }))
            }
            options={STUDY_AVAILABILITY}
            values={draft.study.availability}
          />
          <ChoiceGroup
            label="What would help most?"
            onChange={(goal) =>
              setDraft((current) => ({ ...current, study: { ...current.study, goal } }))
            }
            options={STUDY_GOALS}
            value={draft.study.goal}
          />
          <label>
            <span className={labelClass}>Courses, if you have them</span>
            <input
              className={fieldClass}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  study: { ...current.study, courses: event.target.value },
                }))
              }
              placeholder="CPSC 223, ECON 121"
              value={draft.study.courses}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-extrabold text-ink">{label}</legend>
      <div className="grid gap-2" role="radiogroup">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              aria-checked={selected}
              className="slip px-4 py-3"
              data-picked={selected}
              key={option.value}
              onClick={() => onChange(option.value)}
              role="radio"
              type="button"
            >
              <span className="block font-extrabold">{option.label}</span>
              {option.hint ? (
                <span className={`mt-0.5 block text-sm font-semibold ${selected ? "text-white" : "text-muted"}`}>
                  {option.hint}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function MultiGroup({
  label,
  hint,
  values,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  values: string[];
  options: readonly string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-extrabold text-ink">{label}</legend>
      {hint ? <p className="mb-3 text-sm text-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-2.5">
        {options.map((option) => {
          const selected = values.includes(option);
          return (
            <button
              aria-pressed={selected}
              className="slip slip-rose px-3 py-1.5 text-sm font-bold"
              data-picked={selected}
              key={option}
              onClick={() =>
                onChange(
                  selected ? values.filter((item) => item !== option) : [...values, option],
                )
              }
              type="button"
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
