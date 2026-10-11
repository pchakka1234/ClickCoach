import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmationResult } from '../website/auth-result.mjs';
const config = { url: 'https://example.supabase.co', key: 'public-test' };
test('verification requires a valid signup session and confirmed email', async () => {
  let calls = 0;
  const request = async (url, options) => { calls++; assert.equal(url, config.url + '/auth/v1/user'); assert.equal(options.headers.Authorization, 'Bearer test-token'); return { ok: true, json: async () => ({ email_confirmed_at: '2026-10-11' }) }; };
  assert.equal((await confirmationResult('#access_token=test-token&type=signup', '', config, request)).ok, true);
  assert.equal((await confirmationResult('', '', config, request)).ok, false);
  assert.equal((await confirmationResult('#access_token=test-token&type=recovery', '', config, request)).ok, false);
  assert.equal(calls, 1);
});
test('expired links, network failures and unconfirmed users never display success', async () => {
  const token = '#access_token=test-token&type=signup';
  assert.equal((await confirmationResult('#error=access_denied', '', config, () => assert.fail())).ok, false);
  assert.equal((await confirmationResult('', '?error_code=otp_expired', config, () => assert.fail())).ok, false);
  assert.equal((await confirmationResult(token, '', config, async () => { throw new Error('offline'); })).ok, false);
  assert.equal((await confirmationResult(token, '', config, async () => ({ ok: true, json: async () => ({}) }))).ok, false);
});
