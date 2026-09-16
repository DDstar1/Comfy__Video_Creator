import { authenticatedClient } from "@/lib/server/render-auth";
import { hasUnlimitedGeneration } from "@/lib/server/billing-access";
import { adminClient } from "@/lib/server/admin";

export const runtime = "nodejs";

function unauthorizedOr503(error: unknown, message: string) {
  const unauthorized = error instanceof Error && error.message === "AUTH_REQUIRED";
  return Response.json({ error: unauthorized ? "Sign in with the owner account." : message },
    { status: unauthorized ? 401 : 503 });
}

export async function GET(request: Request) {
  try {
    const { user } = await authenticatedClient(request);
    if (!hasUnlimitedGeneration(user)) return Response.json({ error: "Owner access required." }, { status: 403 });
    const { data, error } = await adminClient().from("comfyTR_payment_settings")
      .select("korapay_mode").eq("id", true).maybeSingle();
    if (error) throw error;
    return Response.json({ mode: data?.korapay_mode ?? "test" });
  } catch (error) {
    return unauthorizedOr503(error, "Payment mode unavailable.");
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await authenticatedClient(request);
    if (!hasUnlimitedGeneration(user)) return Response.json({ error: "Owner access required." }, { status: 403 });
    const body = await request.json();
    const mode = body?.mode;
    if (mode !== "test" && mode !== "live") return Response.json({ error: "Invalid mode." }, { status: 400 });
    const { error } = await adminClient().from("comfyTR_payment_settings")
      .update({ korapay_mode: mode, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", true);
    if (error) throw error;
    return Response.json({ mode });
  } catch (error) {
    return unauthorizedOr503(error, "Payment mode update failed.");
  }
}
