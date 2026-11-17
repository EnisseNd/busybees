"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

type MessageRow = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export async function sendMessage(
  matchId: string,
  content: string,
): Promise<{ ok: true; message: ChatMessage } | { ok: false; message: string }> {
  const profile = await requireUser();
  if (!isUuid(matchId)) return { ok: false, message: "That chat was not found." };

  const text = content.replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, message: "Write a message first." };
  if (text.length > 2000) return { ok: false, message: "Keep it under 2,000 characters." };

  const supabase = await createClient();
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, status, user_id, matched_user_id")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError || !match) return { ok: false, message: "That chat was not found." };

  const row = match as {
    id: string;
    status: string;
    user_id: string;
    matched_user_id: string;
  };
  const participant = row.user_id === profile.id || row.matched_user_id === profile.id;
  if (!participant) return { ok: false, message: "That chat was not found." };
  if (row.status !== "mutual") {
    return { ok: false, message: "Chat opens after you both tap Interested." };
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({ match_id: matchId, sender_id: profile.id, content: text })
    .select("id, sender_id, content, created_at")
    .single();

  if (error || !data) return { ok: false, message: error?.message ?? "Message was not sent." };

  const saved = data as MessageRow;
  revalidatePath(`/chat/${matchId}`);
  return {
    ok: true,
    message: {
      id: saved.id,
      senderId: saved.sender_id,
      content: saved.content,
      createdAt: saved.created_at,
    },
  };
}
