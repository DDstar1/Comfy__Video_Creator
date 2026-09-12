import test from 'node:test';
import assert from 'node:assert/strict';
import { recordAcceptedRender } from '../src/lib/server/render-submission.ts';

test('accepted GPU job retries only its database acknowledgement after a transient error', async () => {
  let attempts = 0;
  await recordAcceptedRender(async () => ({ error: ++attempts === 1 ? { message: 'temporary network failure' } : null }), async () => {});
  assert.equal(attempts, 2);
});

test('persistent acknowledgement failure is surfaced after bounded retries', async () => {
  const failure = new Error('database unavailable');
  let attempts = 0;
  await assert.rejects(recordAcceptedRender(async () => { attempts++; throw failure; }, async () => {}), failure);
  assert.equal(attempts, 3);
});
