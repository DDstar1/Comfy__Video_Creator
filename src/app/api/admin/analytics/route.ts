import { authenticatedClient } from '@/lib/server/render-auth';
import { hasUnlimitedGeneration } from '@/lib/server/billing-access';
import { usageTrackingConfigured } from '@/lib/server/generation-usage';
import { generations, summarize, type RenderRow, type UsageRow } from '@/lib/admin-analytics';
import { fixedRenderRate } from '@/lib/server/render-pricing';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const { client, user } = await authenticatedClient(request);
    if (!hasUnlimitedGeneration(user)) return Response.json({ error: 'Owner access required.' }, { status: 403, headers });
    const params = new URL(request.url).searchParams;
    const days = Number(params.get('days') ?? 30);
    if (![7, 30, 90, 365].includes(days)) return Response.json({ error: 'Invalid date range.' }, { status: 400, headers });
    const until = new Date();
    const since = new Date(until.getTime() - days * 86400000);
    async function records<T>(dataset: string): Promise<T[]> {
      const rows: T[] = [];
      for (let offset = 0; offset < 50000; offset += 1000) {
        const { data, error } = await client.rpc('comfyTR_admin_records', {
          dataset, since_at: since.toISOString(), until_at: until.toISOString(), page_offset: offset,
        });
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Invalid analytics data.');
        rows.push(...data);
        if (data.length < 1000) return rows;
      }
      throw new Error('Too many records. Select a shorter date range.');
    }
    const users = await records('users');
    const renders = await records<RenderRow>('renders');
    const usage = await records<UsageRow>('usage');
    const payments = await records<{ owner_id: string; amount_cents: number }>('payments');
    const wallets = await records<{ balance_cents: number; reserved_cents: number }>('wallets');
    const fixedRate = await fixedRenderRate(client);
    const rows = generations(renders, usage, fixedRate);
    return Response.json({ users, generations: rows, summary: summarize(rows),
      deposits: payments.reduce((sum, row) => sum + Number(row.amount_cents), 0),
      walletLiability: wallets.reduce((sum, row) => sum + Number(row.balance_cents) + Number(row.reserved_cents), 0),
      trackingConfigured: usageTrackingConfigured(), runpodRateCentsPerHour: fixedRate, since: since.toISOString(), until: until.toISOString(),
      netProfit: null,
    }, { headers });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === 'AUTH_REQUIRED';
    return Response.json({ error: unauthorized ? 'Sign in with the owner account.' : 'Analytics unavailable. Check the admin migration and server configuration.' }, { status: unauthorized ? 401 : 503, headers });
  }
}

