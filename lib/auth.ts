import "server-only";

import { redirect } from "next/navigation";
import { isUuid } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type UserRow = {
  id: string;
  email: string;
  college: string;
  class_year: number;
  created_at: string;
};

export async function getOptionalUser(): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const userId = data.claims.sub;
  const email = data.claims.email ?? "";
  const { data: row, error: profileError } = await supabase
    .from("users")
    .select("id, email, college, class_year, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !row) {
    return {
      id: userId,
      email,
      college: "",
      classYear: 0,
      createdAt: "",
      needsProfile: true,
    };
  }

  const profile = row as UserRow;
  return {
    id: profile.id,
    email: profile.email,
    college: profile.college,
    classYear: profile.class_year,
    createdAt: profile.created_at,
    needsProfile: false,
  };
}

export async function requireUser(): Promise<Profile> {
  const profile = await getOptionalUser();
  if (!profile || !isUuid(profile.id)) redirect("/");
  return profile;
}

/** After a fresh sign-in, send new students to the questionnaire. */
export async function pathAfterSignIn(): Promise<string> {
  const profile = await getOptionalUser();
  if (!profile || profile.needsProfile) return "/questionnaire";

  const supabase = await createClient();
  const { data } = await supabase
    .from("questionnaires")
    .select("user_id")
    .eq("user_id", profile.id)
    .maybeSingle();

  return data ? "/matches" : "/questionnaire";
}
