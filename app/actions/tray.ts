"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { validateTray } from "@/lib/tray";
import { createClient } from "@/lib/supabase/server";

const NOT_SET_UP =
  "Trays are not set up on this project yet. Run supabase/migrations/001_trays_and_calendar.sql.";

export async function saveTray(draft: unknown): Promise<{ ok: false; message: string }> {
  const profile = await requireUser();
  if (profile.needsProfile) {
    return {
      ok: false,
      message: "Your profile row is missing. Sign out and create the account again.",
    };
  }

  const parsed = validateTray(draft);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_tray", {
    p_first_name: parsed.firstName,
    p_tray: parsed.tray,
  });

  if (error) {
    // PGRST202: PostgREST cannot find the function. 42883: Postgres cannot either.
    const missing =
      error.code === "PGRST202" ||
      error.code === "42883" ||
      error.code === "42703" ||
      /save_tray|first_name|column .*tray/i.test(error.message);
    return { ok: false, message: missing ? NOT_SET_UP : error.message };
  }

  revalidatePath("/tray");
  revalidatePath("/matches");
  redirect("/matches");
}
