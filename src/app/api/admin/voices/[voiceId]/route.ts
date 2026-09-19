import { authenticatedClient } from '@/lib/server/render-auth';
import { hasUnlimitedGeneration } from '@/lib/server/billing-access';
import { adminClient } from '@/lib/server/admin';

export const runtime = 'nodejs';
const voices = 'comfyTR_platform_voices';
export async function GET(request: Request, context: { params: Promise<{ voiceId: string }> }) {
  try {
    const { user } = await authenticatedClient(request); if (!hasUnlimitedGeneration(user)) return Response.json({ error: 'Owner access required.' }, { status: 403 });
    const { voiceId } = await context.params; const db = adminClient();
    const { data: voice, error } = await db.from(voices).select('*').eq('id', voiceId).single(); if (error || !voice) return Response.json({ error: 'Voice not found.' }, { status: 404 });
    if (!voice.runpod_job_id || !['queued', 'running'].includes(voice.status)) return Response.json({ voice });
    const key = process.env.RUNPOD_ACCOUNT_API_KEY ?? process.env.RUNPOD_ENDPOINT_API_KEY, endpoint = process.env.RUNPOD_QWEN_TTS_ENDPOINT_ID;
    if (!key || !endpoint) return Response.json({ voice });
    const response = await fetch(`https://api.runpod.ai/v2/${endpoint}/status/${encodeURIComponent(voice.runpod_job_id)}`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
    const remote = await response.json().catch(() => ({})); const state = String(remote.status ?? '').toUpperCase();
    if (state === 'IN_QUEUE' || state === 'IN_PROGRESS') { const status = state === 'IN_PROGRESS' ? 'running' : 'queued'; await db.from(voices).update({ status }).eq('id', voice.id); return Response.json({ voice: { ...voice, status } }); }
    if (state !== 'COMPLETED') { const message = typeof remote.error === 'string' ? remote.error : 'Voice generation failed.'; await db.from(voices).update({ status: 'failed', error_message: message }).eq('id', voice.id); return Response.json({ voice: { ...voice, status: 'failed', error_message: message } }); }
    const artifact = remote.output?.audio; const source = typeof artifact?.data === 'string' ? artifact.data : '';
    if (!source) throw new Error('Qwen completed without WAV audio.');
    const bytes = Buffer.from(source.replace(/^data:audio\/wav;base64,/, ''), 'base64'); if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw new Error('Generated audio is invalid.');
    const path = `${voice.id}/voice.wav`; const upload = await db.storage.from('comfytr-platform-voices').upload(path, bytes, { contentType: 'audio/wav', upsert: true }); if (upload.error) throw upload.error;
    const { data: updated, error: updateError } = await db.from(voices).update({ status: 'ready', storage_path: path, completed_at: new Date().toISOString(), error_message: null }).eq('id', voice.id).select('*').single(); if (updateError) throw updateError;
    const signed = await db.storage.from('comfytr-platform-voices').createSignedUrl(path, 3600); return Response.json({ voice: updated, audioUrl: signed.data?.signedUrl });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Voice status could not be read.' }, { status: 502 }); }
}
