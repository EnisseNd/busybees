"use client";

import { useActionState, useState } from "react";
import { authenticate } from "@/app/actions/auth";
import { CLASS_YEARS, COLLEGES } from "@/lib/constants";
import { fieldClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/lib/styles";
import type { AuthFormState } from "@/lib/types";

const idleState: AuthFormState = { message: "", tone: "idle" };

export function AuthForm({
  configured,
  nextPath,
  initialState = idleState,
}: {
  configured: boolean;
  nextPath: string;
  initialState?: AuthFormState;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [state, formAction, pending] = useActionState(authenticate, initialState);
  const creating = mode === "sign-up";

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 rounded-full bg-paper-deep p-1 text-sm font-semibold">
        <button
          className={mode === "sign-in" ? "rounded-full bg-white text-ink shadow-sm" : "text-muted"}
          onClick={() => setMode("sign-in")}
          type="button"
        >
          Sign in
        </button>
        <button
          className={mode === "sign-up" ? "rounded-full bg-white text-ink shadow-sm" : "text-muted"}
          onClick={() => setMode("sign-up")}
          type="button"
        >
          Create account
        </button>
      </div>

      {!configured ? (
        <p className="mb-4 rounded-2xl bg-paper-deep px-3 py-2 text-sm text-ink" role="status">
          Supabase is not connected yet. Copy <code>.env.example</code> to <code>.env.local</code> and
          add your project URL and key.
        </p>
      ) : null}

      {state.message ? (
        <p
          className={`mb-4 rounded-2xl px-3 py-2 text-sm ${
            state.tone === "error" ? "bg-red-50 text-clay" : "bg-emerald-50 text-moss"
          }`}
          role={state.tone === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}

      <form action={formAction} className="grid gap-4">
        <input name="account" type="hidden" value={mode} />
        <input name="next" type="hidden" value={nextPath} />

        <label className="block">
          <span className={labelClass}>Yale email</span>
          <input
            autoComplete="email"
            className={fieldClass}
            disabled={!configured || pending}
            name="email"
            placeholder="you@yale.edu"
            required
            spellCheck={false}
            type="email"
          />
        </label>

        <label className="block">
          <span className={labelClass}>Password</span>
          <input
            autoComplete={creating ? "new-password" : "current-password"}
            className={fieldClass}
            disabled={!configured || pending}
            name="password"
            placeholder={creating ? "At least 8 characters" : "Your password"}
            type="password"
          />
        </label>

        {creating ? (
          <>
            <label className="block">
              <span className={labelClass}>Residential college</span>
              <select className={fieldClass} disabled={!configured || pending} name="college" required>
                <option value="">Choose your college</option>
                {COLLEGES.map((college) => (
                  <option key={college} value={college}>
                    {college}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Class year</span>
              <select
                className={fieldClass}
                defaultValue=""
                disabled={!configured || pending}
                name="class_year"
                required
              >
                <option value="">Graduation year</option>
                {CLASS_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <button
            className={primaryButtonClass}
            disabled={!configured || pending}
            name="intent"
            type="submit"
            value={creating ? "sign-up-password" : "sign-in-password"}
          >
            {pending ? "Working…" : creating ? "Create account" : "Sign in"}
          </button>
          <button
            className={secondaryButtonClass}
            disabled={!configured || pending}
            name="intent"
            type="submit"
            value="magic-link"
          >
            Email me a link
          </button>
        </div>
      </form>
      <p className="mt-4 text-sm leading-6 text-muted">
        {creating
          ? "New accounts are limited to @yale.edu. Password and magic link both store your college and class year."
          : "Magic link sign-in is for accounts that already exist. New students should create an account first."}
      </p>
    </div>
  );
}
