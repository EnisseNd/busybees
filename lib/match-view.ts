import type { MatchResponse } from "@/lib/types";

type Pair = {
  user_id: string;
  matched_user_id: string;
};

type SidedMatch = Pair & {
  user_response: MatchResponse;
  matched_response: MatchResponse;
};

export function partnerId(match: Pair, viewerId: string): string {
  return match.user_id === viewerId ? match.matched_user_id : match.user_id;
}

export function viewerResponse(match: SidedMatch, viewerId: string): MatchResponse {
  return match.user_id === viewerId ? match.user_response : match.matched_response;
}

export function partnerResponse(match: SidedMatch, viewerId: string): MatchResponse {
  return match.user_id === viewerId ? match.matched_response : match.user_response;
}
