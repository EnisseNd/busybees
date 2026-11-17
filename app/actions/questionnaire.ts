"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { validateQuestionnaire } from "@/lib/questionnaire";
import { createClient } from "@/lib/supabase/server";

export async function saveQuestionnaire(
  draft: unknown,
): Promise<{ ok: false; message: string }> {
  const profile = await requireUser();
  if (profile.needsProfile) {
    return {
      ok: false,
      message: "Your profile row is missing. Sign out and create the account again.",
    };
  }

  const parsed = validateQuestionnaire(draft);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { error } = await supabase.from("questionnaires").upsert({
    user_id: profile.id,
    answers: parsed.answers,
    looking_for_study_buddy: parsed.lookingForStudyBuddy,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/questionnaire");
  revalidatePath("/matches");
  redirect("/matches");
}
