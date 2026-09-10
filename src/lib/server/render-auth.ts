import "server-only";

import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

export async function authenticatedClient(request: Request): Promise<{
  client: SupabaseClient;
  user: User;
}> {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) throw new Error("AUTH_REQUIRED");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  return { client, user: data.user };
}
