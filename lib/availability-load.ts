import "server-only";

import { normalizeEvents } from "@/lib/plan";
import type { AvailabilitySnapshot } from "@/lib/availability";
import { createClient } from "@/lib/supabase/server";

type LoadOne =
  | { kind: "ready"; snapshot: AvailabilitySnapshot }
  | { kind: "missing" }
  | { kind: "none" };

export async function loadMatchAvailability(matchId: string): Promise<LoadOne> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_availability", { target_match: matchId });
  if (error) return isMissingFunction(error) ? { kind: "missing" } : { kind: "none" };
  return parseSnapshot(data);
}

export async function loadAvailabilityForMatches(matchIds: string[]): Promise<{
  missing: boolean;
  byId: Map<string, AvailabilitySnapshot>;
}> {
  const byId = new Map<string, AvailabilitySnapshot>();
  if (matchIds.length === 0) return { missing: false, byId };

  const results = await Promise.all(matchIds.map((id) => loadMatchAvailability(id)));
  if (results.every((result) => result.kind === "missing")) return { missing: true, byId };

  results.forEach((result, index) => {
    if (result.kind === "ready") byId.set(matchIds[index], result.snapshot);
  });
  return { missing: false, byId };
}

function parseSnapshot(data: unknown): LoadOne {
  if (!data || typeof data !== "object") return { kind: "none" };
  const row = data as Record<string, unknown>;
  if (row.closed === true) return { kind: "none" };
  return {
    kind: "ready",
    snapshot: {
      youConnected: row.youConnected === true,
      themConnected: row.themConnected === true,
      you: normalizeEvents(row.you),
      them: normalizeEvents(row.them),
    },
  };
}

function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /match_availability/i.test(error.message ?? "")
  );
}
