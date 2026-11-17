"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export async function respondToMatch(
  matchId: string,
  response: "interested" | "passed",
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireUser();
  if (!isUuid(matchId)) return { ok: false, message: "That match was not found." };
  if (response !== "interested" && response !== "passed") {
    return { ok: false, message: "Choose interested or pass." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_match", {
    target_match: matchId,
    response,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/matches");
  revalidatePath(`/chat/${matchId}`);
  return { ok: true };
}
