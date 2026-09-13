import 'server-only';
import { adminClient } from './admin';
import { configuredRate, tokenCost } from '../admin-analytics';

export function usageTrackingConfigured() {
  return Boolean(
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY) &&
      process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export async function recordUsage(row: Record<string, unknown>) {
  if (!usageTrackingConfigured()) return;
  try {
    const { error } = await adminClient().from('comfyTR_generation_usage').upsert(row, { onConflict: 'id' });
    if (error) throw error;
  } catch {
    // Never log prompts, credentials, or provider response bodies.
    console.error('Generation usage could not be persisted. Admin cost coverage is incomplete.');
  }
}

export function openAIUsage(response: {
  id: string; model: string; usage?: {
    input_tokens: number; output_tokens: number;
    input_tokens_details?: { cached_tokens?: number };
  } | null;
}) {
  const rates = {
    input: configuredRate(process.env.ADMIN_OPENAI_INPUT_CENTS_PER_MILLION),
    cached: configuredRate(process.env.ADMIN_OPENAI_CACHED_CENTS_PER_MILLION),
    output: configuredRate(process.env.ADMIN_OPENAI_OUTPUT_CENTS_PER_MILLION),
  };
  const usage = response.usage;
  return {
    external_id: response.id, model: response.model,
    input_tokens: usage?.input_tokens ?? null,
    cached_tokens: usage?.input_tokens_details?.cached_tokens ?? null,
    output_tokens: usage?.output_tokens ?? null,
    estimated_cost_cents: usage && process.env.ADMIN_OPENAI_MODEL === response.model
      ? tokenCost(usage.input_tokens, usage.input_tokens_details?.cached_tokens ?? 0, usage.output_tokens, rates) : null,
    rate_snapshot: { ...rates, model: process.env.ADMIN_OPENAI_MODEL ?? null, excludes_tools: true },
  };
}
