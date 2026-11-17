import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase/env";

/** Service-role client. Use only from the cron route. */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();
  if (!url || !key) {
    throw new Error(
      "Set SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) before generating matches.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
