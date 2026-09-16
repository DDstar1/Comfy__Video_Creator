import "server-only";
import { adminClient } from "@/lib/server/admin";

export type KorapayMode = "test" | "live";

// The current mode is stored in the database (comfyTR_payment_settings), not
// an env var, so an admin can switch it at runtime without a redeploy.
export async function getKorapayMode(): Promise<KorapayMode> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("comfyTR_payment_settings")
    .select("korapay_mode")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return data?.korapay_mode === "live" ? "live" : "test";
}

export function korapayKeys(mode: KorapayMode) {
  return mode === "live"
    ? { publicKey: process.env.KORAPAY_PUBLIC_KEY_LIVE, secretKey: process.env.KORAPAY_SECRET_KEY_LIVE }
    : { publicKey: process.env.KORAPAY_PUBLIC_KEY_TEST, secretKey: process.env.KORAPAY_SECRET_KEY_TEST };
}
