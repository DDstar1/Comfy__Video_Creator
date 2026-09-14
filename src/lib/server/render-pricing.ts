import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const SETTINGS = 'comfyTR_pricing_settings';
const RENDER_KEY = 'runpod_render';

export async function fixedRenderRate(client: SupabaseClient): Promise<number> {
  const { data, error } = await client
    .from(SETTINGS)
    .select('rate_cents_per_hour')
    .eq('pricing_key', RENDER_KEY)
    .single();
  if (error || !data) throw new Error('The fixed RunPod render price is not configured in Supabase.');
  const rate = Number(data.rate_cents_per_hour);
  if (!Number.isFinite(rate) || rate < 0) throw new Error('The fixed RunPod render price in Supabase is invalid.');
  return rate;
}