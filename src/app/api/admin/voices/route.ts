import { z } from 'zod';
import { authenticatedClient } from '@/lib/server/render-auth';
import { hasUnlimitedGeneration } from '@/lib/server/billing-access';
import { adminClient } from '@/lib/server/admin';

export const runtime = 'nodejs';
const voices = 'comfyTR_platform_voices';
const schema = z.object({ name: z.string().trim().min(1).max(80), voiceDescription: z.string().trim().min(1).max(1000), sampleText: z.string().trim().min(1).max(2000), language: z.string().trim().min(1).max(40).default('English'), seed: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) });

function endpoint() {
  const key = process.env.RUNPOD_ACCOUNT_API_KEY ?? process.env.RUNPOD_ENDPOINT_API_KEY;
  const id = process.env.RUNPOD_QWEN_TTS_ENDPOINT_ID;
  if (!key || !id) throw new Error('Qwen voice endpoint is not configured. Set RUNPOD_QWEN_TTS_ENDPOINT_ID on the web deployment.');
  return { key, id };
}
async function owner(request: Request) {
  const { user } = await authenticatedClient(request);
  if (!hasUnlimitedGeneration(user)) throw new Error('OWNER_REQUIRED');
  return user;
}
export async function GET(request: Request) {
  try { await owner(request); const { data, error } = await adminClient().from(voices).select('*').order('created_at', { ascending: false }); if (error) throw error; return Response.json({ voices: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error && error.message === 'OWNER_REQUIRED' ? 'Owner access required.' : 'Voice library is unavailable.' }, { status: 403 }); }
}
export async function POST(request: Request) {
  try {
    await owner(request);
    if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Same-origin requests required.' }, { status: 403 });
    const input = schema.parse(await request.json());
    const db = adminClient();
    const { data: voice, error } = await db.from(voices).insert({ name: input.name, voice_description: input.voiceDescription, sample_text: input.sampleText, language: input.language, seed: input.seed }).select('*').single();
    if (error || !voice) throw error ?? new Error('Voice record could not be created.');
    try {
      const remote = endpoint();
      const response = await fetch(`https://api.runpod.ai/v2/${remote.id}/run`, { method: 'POST', headers: { Authorization: `Bearer ${remote.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ input: { text: input.sampleText, instruct: input.voiceDescription, language: input.language, seed: input.seed, filename: `${voice.id}.wav` } }), cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.id !== 'string') throw new Error(typeof result.error === 'string' ? result.error : 'Qwen did not accept the voice job.');
      await db.from(voices).update({ runpod_job_id: result.id, status: 'queued' }).eq('id', voice.id);
      return Response.json({ voice: { ...voice, runpod_job_id: result.id, status: 'queued' } }, { status: 202 });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Voice job submission failed.';
      await db.from(voices).update({ status: 'failed', error_message: message }).eq('id', voice.id);
      return Response.json({ error: message, voiceId: voice.id }, { status: 503 });
    }
  } catch (error) { return Response.json({ error: error instanceof z.ZodError ? 'Enter a name, voice description, sample text, and seed.' : error instanceof Error ? error.message : 'Voice creation failed.' }, { status: 400 }); }
}
