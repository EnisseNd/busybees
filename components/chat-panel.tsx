"use client";

import { useEffect, useRef, useState } from "react";
import { sendMessage } from "@/app/actions/messages";
import type { ChatMessage } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { fieldClass, primaryButtonClass } from "@/lib/styles";

export function ChatPanel({
  matchId,
  currentUserId,
  initialMessages,
}: {
  matchId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function pull() {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (cancelled || !data) return;
      setMessages(data.map(toMessage));
    }

    // Realtime when the messages table is in the publication. Polling covers
    // the gap if replication is still off.
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const row = payload.new;
          if (!isRow(row)) return;
          setMessages((current) => mergeMessages(current, [toMessage(row)]));
        },
      )
      .subscribe();

    const poll = window.setInterval(() => {
      void pull();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [matchId]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = text;
    if (!content.trim() || pending) return;
    setPending(true);
    setError("");
    const result = await sendMessage(matchId, content);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setText("");
    setMessages((current) => mergeMessages(current, [result.message]));
  }

  return (
    <div className="flex min-h-[28rem] flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <p className="text-sm font-semibold text-muted">Nobody has said anything yet. Say hi and pick a time.</p>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === currentUserId;
            return (
              <div className={mine ? "flex justify-end" : "flex justify-start"} key={message.id}>
                <div className={mine ? "chat-note chat-note-mine" : "chat-note"}>
                  <p>{message.content}</p>
                  <p className={`mt-1 text-xs font-semibold ${mine ? "text-white" : "text-muted"}`}>
                    {formatTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form className="mt-2 flex items-end gap-2" onSubmit={onSubmit}>
        <label className="flex-1">
          <span className="sr-only">Message</span>
          <textarea
            className={fieldClass}
            maxLength={2000}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Write a message"
            rows={2}
            value={text}
          />
        </label>
        <button className={primaryButtonClass} disabled={pending} type="submit">
          {pending ? "Sending…" : "Send"}
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-sm font-bold text-alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function toMessage(row: {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}): ChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
  };
}

function isRow(value: unknown): value is {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
} {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.sender_id === "string" &&
    typeof row.content === "string" &&
    typeof row.created_at === "string"
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
