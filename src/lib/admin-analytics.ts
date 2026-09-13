export type Generation = {
  id: string; owner_id: string | null; project_id: string | null;
  provider: 'openai' | 'runpod'; status: string; created_at: string;
  model?: string | null; action?: string; input_tokens?: number | null;
  output_tokens?: number | null; runtime_ms?: number | null;
  revenue: number; cost: number | null;
};
export type AdminUser = { id: string; email: string; full_name: string; created_at: string };
export type UsageRow = Omit<Generation, 'revenue' | 'cost'> & { external_id: string | null; estimated_cost_cents: number | null };
export type RenderRow = Omit<Generation, 'provider' | 'revenue' | 'cost'> & { charged_cents: number | null };

export function configuredRate(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function tokenCost(input: number, cached: number, output: number, rates: { input: number | null; cached: number | null; output: number | null }) {
  if (rates.input === null || rates.cached === null || rates.output === null) return null;
  return (Math.max(0, input - cached) * rates.input + cached * rates.cached + output * rates.output) / 1_000_000;
}

export function generations(renders: RenderRow[], usage: UsageRow[], legacyRate: number | null): Generation[] {
  const recorded = new Map(usage.filter(row => row.provider === 'runpod').map(row => [row.external_id, row]));
  return [
    ...renders.map(row => {
      const snapshot = recorded.get(row.id);
      return { ...row, provider: 'runpod' as const, revenue: Number(row.charged_cents ?? 0),
        runtime_ms: snapshot?.runtime_ms ?? row.runtime_ms,
        cost: snapshot ? snapshot.estimated_cost_cents :
          (legacyRate !== null && Number(row.runtime_ms) > 0 ? Number(row.runtime_ms) / 3_600_000 * legacyRate : null) };
    }),
    ...usage.filter(row => row.provider === 'openai').map(row => ({ ...row, revenue: 0, cost: row.estimated_cost_cents })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function summarize(rows: Generation[]) {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const cost = rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
  const unknown = rows.filter(row => row.cost === null).length;
  const completed = rows.filter(row => row.status === 'completed').length;
  const failed = rows.filter(row => ['failed', 'cancelled'].includes(row.status)).length;
  return { count: rows.length, revenue, cost, unknown, completed, failed,
    margin: revenue - cost, active: rows.length - completed - failed,
    successRate: completed + failed ? completed / (completed + failed) * 100 : null };
}
