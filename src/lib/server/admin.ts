import "server-only";
import { createClient } from "@supabase/supabase-js";

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // SUPABASE_SERVICE_KEY is the existing project variable. Keep the official
  // SERVICE_ROLE spelling compatible for deployments that use that convention.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase payment administration is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
