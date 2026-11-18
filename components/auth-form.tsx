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
      <div className="paper-tabs mb-5" role="tablist">
        <button
          aria-selected={mode === "sign-in"}
          className="paper-tab"
          onClick={() => setMode("sign-in")}
          role="tab"
          type="button"
        >
          Sign in
        </button>
        <button
          aria-selected={mode === "sign-up"}
          className="paper-tab"
          onClick={() => setMode("sign-up")}
          role="tab"
          type="button"
        >
          Create account
        </button>
      </div>

      {!configured ? (
        <p className="mb-4 rounded-[2px] border-2 border-dashed border-hairline bg-scrap px-3 py-2 text-sm font-semibold text-ink" role="status">
          Sign-in is off because the database isn&rsquo;t connected yet. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code> and add the Supabase project URL and key.
        </p>
      ) : null}

      {state.message ? (
        <p
          className={`mb-4 rounded-[2px] border-2 px-3 py-2 text-sm font-bold ${
            state.tone === "error" ? "border-alert bg-white text-alert" : "border-leaf bg-scrap text-leaf"
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

        <div className="mt-1 flex flex-col gap-3 sm:flex-row">
          <button
            className={primaryButtonClass}
            disabled={!configured || pending}
            name="intent"
            type="submit"
            value={creating ? "sign-up-password" : "sign-in-password"}
          >
            {pending ? "One second…" : creating ? "Create account" : "Sign in"}
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
          ? "You need an @yale.edu address. We keep your college and class year with the account."
          : "The emailed link only works if you already have an account. New here? Create one first."}
      </p>
    </div>
  );
}
