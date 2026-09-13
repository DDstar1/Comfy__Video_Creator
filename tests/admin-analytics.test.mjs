import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configuredRate, tokenCost, generations, summarize } from '../src/lib/admin-analytics.ts';

test('unconfigured prices remain unknown; configured zero is valid', () => {
  for (const value of [undefined, '', ' ', '-1', 'NaN', 'Infinity']) assert.equal(configuredRate(value), null);
  assert.equal(configuredRate('0'), 0);
  assert.equal(tokenCost(1000, 200, 100, { input: 100, cached: 50, output: 400 }), .13);
  assert.equal(tokenCost(1000, 0, 100, { input: null, cached: 50, output: 400 }), null);
});
test('owner generations and failed attempts contribute cost without invented revenue', () => {
  const renders = [
    { id: 'a', owner_id: 'owner', status: 'completed', created_at: '2026-09-13', runtime_ms: 3600000, charged_cents: 0 },
    { id: 'b', owner_id: 'customer', status: 'failed', created_at: '2026-09-12', runtime_ms: null, charged_cents: 0 },
    { id: 'c', owner_id: 'customer', status: 'completed', created_at: '2026-09-11', runtime_ms: 0, charged_cents: 59 },
  ];
  const usage = [
    { id: 'b', external_id: 'b', provider: 'runpod', estimated_cost_cents: 10 },
    { id: 'd', provider: 'openai', status: 'failed', created_at: '2026-09-10', estimated_cost_cents: 5 },
  ];
  const rows = generations(renders, usage, 58);
  assert.equal(rows.length, 4);
  const total = summarize(rows);
  assert.equal(total.revenue, 59);
  assert.equal(total.cost, 73);
  assert.equal(total.unknown, 1);
  assert.equal(total.margin, -14);
  assert.equal(total.successRate, 50);
});
test('unknown historical prices never become free generations', () => {
  assert.equal(generations([{ id: 'a', created_at: '2026-09-13', runtime_ms: 2000 }], [], null)[0].cost, null);
  assert.equal(summarize([]).successRate, null);
});
test('new snapshots retain unknown costs when rates subsequently change', () => {
  const rows = generations([{ id: 'a', created_at: '2026-09-13', runtime_ms: 2000 }],
    [{ id: 'a', external_id: 'a', provider: 'runpod', runtime_ms: 3000, estimated_cost_cents: null }], 58);
  assert.equal(rows[0].cost, null);
  assert.equal(rows[0].runtime_ms, 3000);
});
test('cross-tenant RPC checks verified identity and prohibits customer telemetry writes', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20260913000001_comfyTR_admin_analytics.sql', import.meta.url), 'utf8');
  assert.match(sql, /id = auth.uid\(\)/);
  assert.match(sql, /email_confirmed_at is not null/);
  assert.match(sql, /revoke all on public\."comfyTR_generation_usage" from public, anon, authenticated/);
  assert.match(sql, /else raise exception 'Unknown dataset'/);
});
