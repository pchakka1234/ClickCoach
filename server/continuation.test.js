import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
const id = '11111111-1111-4111-8111-111111111111';
const plan = { title: 'Updated guide', summary: 'Use the View menu instead.', steps: [{ title: 'View', instruction: 'Open View', expectedResult: 'Menu opens' }] };
async function fixture(t, { conflict = false, missing = false, failOnce = false } = {}) {
  let row = { id, goal: 'Freeze row', ...plan, source_url: 'https://example.com/', current_step: 0, completed: [0], version: 1, conversation: [] };
  const inputs = [], writes = [], filters = [];
  let attempts = 0;
  const factory = () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from() {
    let payload;
    const q = { select: () => q, eq: (...v) => { filters.push(v); return q; }, update: v => { payload = v; writes.push(v); return q; }, async maybeSingle() {
      if (missing) return { data: null };
      if (payload) { if (conflict) return { data: null }; row = { ...row, ...payload }; }
      return { data: row };
    } }; return q;
  } });
  const app = createApp({ supabaseUrl: 'https://example.com', supabaseKey: 'test', extensionId: 'a'.repeat(32) }, { clientFactory: factory, planner: async input => { inputs.push(input); if (failOnce && attempts++ === 0) throw Object.assign(new Error('Provider failed'), { status: 502 }); return plan; } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));
  return { inputs, writes, filters, send: body => fetch(`http://127.0.0.1:${server.address().port}/api/tutorials/${id}/continue`, { method: 'POST', headers: { Authorization: 'Bearer good', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) };
}
test('continues twice on the same guide, preserving conversation and omitting stored screenshots', async t => {
  const f = await fixture(t);
  const response = await f.send({ message: 'Where is View?', version: 1, context: { url: 'https://example.com/new?token=secret#private', title: 'New page', screenshot: 'data:image/jpeg;base64,YQ==' } });
  assert.equal(response.status, 200);
  const first = await response.json();
  assert.equal(first.id, id); assert.equal(first.version, 2); assert.deepEqual(first.completed, []);
  assert.equal(first.source_url, 'https://example.com/new'); assert.equal(first.conversation.length, 2);
  assert.ok(!JSON.stringify(f.writes).includes('base64'));
  assert.equal(f.inputs[0].continuation.currentStep, 0);
  assert.deepEqual(f.inputs[0].continuation.completed, [0]);
  const second = await f.send({ message: 'Now what?', version: 2 });
  assert.equal(second.status, 200); assert.equal((await second.json()).conversation.length, 4);
  assert.equal(f.inputs[1].continuation.conversation.length, 2); assert.equal(f.inputs[1].context.screenshot, undefined);
  assert.ok(f.filters.some(([k, v]) => k === 'user_id' && v === 'owner'));
});
test('rejects stale versions before calling provider', async t => { const f = await fixture(t); assert.equal((await f.send({ message: 'Help', version: 2 })).status, 409); assert.equal(f.inputs.length, 0); });
test('handles a concurrent change during generation', async t => { const f = await fixture(t, { conflict: true }); assert.equal((await f.send({ message: 'Help', version: 1 })).status, 409); });
test('does not expose missing guides', async t => { const f = await fixture(t, { missing: true }); assert.equal((await f.send({ message: 'Help', version: 1 })).status, 404); });
test('allows retry after provider failure without saving a partial turn', async t => { const f = await fixture(t, { failOnce: true }); assert.equal((await f.send({ message: 'Help', version: 1 })).status, 502); assert.equal(f.writes.length, 0); assert.equal((await f.send({ message: 'Help', version: 1 })).status, 200); });
test('validates follow-up messages and screenshot URLs', async t => { const f = await fixture(t); for (const body of [{ message: '', version: 1 }, { message: 'Help', version: 1, context: { title: 'x', url: 'javascript:alert(1)' } }]) assert.equal((await f.send(body)).status, 400); });
