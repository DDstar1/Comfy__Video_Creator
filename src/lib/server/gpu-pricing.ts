import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function configuredGpuRate(client: SupabaseClient, gpuModel: string | null) {
  if (!gpuModel) return null;
  const { data, error } = await client.from('comfyTR_gpu_pricing')
    .select('rate_cents_per_hour').eq('gpu_model', gpuModel).eq('enabled', true).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const rate = Number(data.rate_cents_per_hour);
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
}