import test from 'node:test';
import assert from 'node:assert/strict';
import { readRenderStatus } from '../src/lib/render-status.ts';

test('render status recovers from transport and upstream failures without resubmission', async () => {
  let calls = 0;
  const response = await readRenderStatus(async () => {
    calls++;
    if (calls === 1) throw new TypeError('offline');
    return new Response('{}', { status: calls === 2 ? 502 : 200 });
  }, async () => {});
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
});

test('authentication rejection is not retried as a temporary upstream failure', async () => {
  let calls = 0;
  const response = await readRenderStatus(async () => { calls++; return new Response('{}', { status: 401 }); }, async () => {});
  assert.equal(response.status, 401);
  assert.equal(calls, 1);
});

test('status retry stops after five failed attempts', async () => {
  let calls = 0;
  const response = await readRenderStatus(async () => { calls++; return new Response('{}', { status: 503 }); }, async () => {});
  assert.equal(response.status, 503);
  assert.equal(calls, 5);
});
