"use server";

import { redirect } from "next/navigation";
import { pathAfterSignIn } from "@/lib/auth";
import { CLASS_YEARS, COLLEGES, isYaleEmail } from "@/lib/constants";
import type { AuthFormState } from "@/lib/types";
import { isSupabaseConfigured, getSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function authenticate(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) {
    return {
      tone: "error",
      message: "Add the Supabase env vars in .env.local, then restart the dev server.",
    };
  }

  const intent = String(formData.get("intent") ?? "");
  const account = String(formData.get("account") ?? "sign-in");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const college = String(formData.get("college") ?? "");
  const classYear = Number(formData.get("class_year"));
  const requestedNext = safeNext(String(formData.get("next") ?? ""));

  if (!isYaleEmail(email)) {
    return { tone: "error", message: "Use your @yale.edu email address." };
  }

  const creating = account === "sign-up" || intent === "sign-up-password";
  if (creating && !isProfileComplete(college, classYear)) {
    return {
      tone: "error",
      message: "Choose your residential college and class year.",
    };
  }

  const supabase = await createClient();
  const origin = getSiteUrl();

  if (intent === "magic-link") {
    const next = creating ? "/questionnaire" : requestedNext || "/matches";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: creating,
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: creating ? { college, class_year: classYear } : undefined,
      },
    });
    if (error) return { tone: "error", message: friendlyAuthError(error.message) };
    return {
      tone: "ok",
      message: creating
        ? "Check your Yale inbox for a link to finish creating the account."
        : "Check your Yale inbox for a sign-in link.",
    };
  }

  if (intent === "sign-up-password") {
    if (password.length < 8) {
      return { tone: "error", message: "Use a password of at least 8 characters." };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/questionnaire")}`,
        data: { college, class_year: classYear },
      },
    });
    if (error) return { tone: "error", message: friendlyAuthError(error.message) };
    if (!data.session) {
      return {
        tone: "ok",
        message: "Check your Yale inbox and confirm the account, then sign in.",
      };
    }
    redirect("/questionnaire");
  }

  if (intent === "sign-in-password") {
    if (!password) return { tone: "error", message: "Enter your password." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { tone: "error", message: friendlyAuthError(error.message) };
    redirect(requestedNext || (await pathAfterSignIn()));
  }

  return { tone: "error", message: "Choose sign in or create account." };
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

function isProfileComplete(college: string, classYear: number): boolean {
  return (
    COLLEGES.includes(college as (typeof COLLEGES)[number]) &&
    CLASS_YEARS.includes(classYear as (typeof CLASS_YEARS)[number])
  );
}

function safeNext(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("..")) {
    return "";
  }
  if (value.startsWith("/questionnaire") || value.startsWith("/matches") || value.startsWith("/chat/")) {
    return value;
  }
  return "";
}

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("yale") ||
    lower.includes("college") ||
    lower.includes("class year") ||
    lower.includes("database error saving new user")
  ) {
    return "Accounts need a @yale.edu address, a residential college, and a class year.";
  }
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "That email and password didn't match.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "That email already has an account. Sign in instead.";
  }
  if (lower.includes("signups not allowed") || lower.includes("user not found")) {
    return "No account for that email yet. Create one with your college and class year.";
  }
  return message;
}
