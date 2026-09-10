import { authenticatedClient } from "@/lib/server/render-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { client, user } = await authenticatedClient(request);
    const { data, error } = await client.from("comfyTR_wallets")
      .select("balance_cents,reserved_cents,updated_at").eq("owner_id", user.id).maybeSingle();
    if (error) throw error;
    return Response.json(data ?? { balance_cents: 0, reserved_cents: 0 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Wallet unavailable." }, { status: 401 });
  }
}
