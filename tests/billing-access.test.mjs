import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUnlimitedGeneration } from '../src/lib/server/billing-access.ts';
test('only the verified designated account receives unlimited generation', () => {
  assert.equal(hasUnlimitedGeneration({ email: 'abhuluimendestiny@gmail.com', email_confirmed_at: '2026-09-11' }), true);
  assert.equal(hasUnlimitedGeneration({ email: 'abhuluimendestiny@gmail.com' }), false);
  assert.equal(hasUnlimitedGeneration({ email: 'other@gmail.com', email_confirmed_at: '2026-09-11' }), false);
  assert.equal(hasUnlimitedGeneration({}), false);
});
