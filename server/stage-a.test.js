import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { planSchema } from './schema.js';

// Stateful test double. This exercises HTTP routes; it does NOT prove live Supabase RLS.
async function fixture(t) {
  const rows = new Map();
  const state = { unavailable: false };
  const clientFactory = (_url, _key, options) => ({
    auth: { getUser: async token => ({ data: { user: ['alice', 'bob'].includes(token) ? { id: token } : null } }) },
    from() {
      const filters = [];
      let action = 'select', payload, single = false;
      const query = {
        select() { return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        order() { return this; }, limit() { return this; },
        insert(value) { action = 'insert'; payload = value; return this; },
        update(value) { action = 'update'; payload = value; return this; },
        delete() { action = 'delete'; return this; },
        single() { single = true; return this; },
        maybeSingle() { single = true; return this; },
        then(resolve, reject) {
          if (state.unavailable) return Promise.resolve({ data: null, error: { message: 'offline' } }).then(resolve, reject);
          let selected;
          if (action === 'insert') {
            const row = { id: randomUUID(), current_step: 0, completed: [], version: 1, created_at: new Date().toISOString(), ...payload };
            rows.set(row.id, row); selected = [row];
          } else {
            selected = [...rows.values()].filter(row => filters.every(([key, value]) => row[key] === value));
            if (action === 'update') selected.forEach(row => Object.assign(row, payload));
            if (action === 'delete') selected.forEach(row => rows.delete(row.id));
          }
          return Promise.resolve({ data: structuredClone(single ? selected[0] || null : selected), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  });
  const server = createApp({ supabaseUrl: 'https://example.supabase.co', supabaseKey: 'test', extensionId: 'a'.repeat(32), aiProvider: 'mock' }, { clientFactory }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const request = (user, path = '', method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}/api/tutorials${path}`, {
    method, headers: { Authorization: `Bearer ${user}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const create = async () => {
    const response = await request('alice', '', 'POST', { goal: 'Freeze the heading row', context: { url: 'https://example.com/sheet', title: 'Sample sheet' } });
    assert.equal(response.status, 201);
    return response.json();
  };
  return { request, create, rows, state };
}

test('Stage A: mock guide is structured; progress persists when reopened and listed', async t => {
  const { request, create } = await fixture(t);
  const row = await create();
  planSchema.parse({ title: row.title, summary: row.summary, steps: row.steps });
  const save = await request('alice', `/${row.id}`, 'PATCH', { currentStep: 1, completed: [0], version: 1 });
  assert.equal(save.status, 200);
  const updated = await save.json();
  assert.equal(updated.version, 2);
  const reopened = await (await request('alice', `/${row.id}`)).json();
  assert.equal(reopened.current_step, 1);
  assert.deepEqual(reopened.completed, [0]);
  assert.deepEqual((await (await request('alice')).json())[0].completed, [0]);
});

test('Stage A: second user cannot list, read, edit, or delete another user guide', async t => {
  const { request, create } = await fixture(t);
  const row = await create();
  assert.deepEqual(await (await request('bob')).json(), []);
  assert.equal((await request('bob', `/${row.id}`)).status, 404);
  assert.equal((await request('bob', `/${row.id}`, 'PATCH', { currentStep: 1, completed: [0], version: 1 })).status, 404);
  assert.equal((await request('bob', `/${row.id}`, 'DELETE')).status, 204);
  assert.equal((await request('alice', `/${row.id}`)).status, 200);
});

test('Stage A: stale progress version returns 409 without overwriting saved progress', async t => {
  const { request, create } = await fixture(t);
  const row = await create();
  assert.equal((await request('alice', `/${row.id}`, 'PATCH', { currentStep: 1, completed: [0], version: 1 })).status, 200);
  assert.equal((await request('alice', `/${row.id}`, 'PATCH', { currentStep: 0, completed: [], version: 1 })).status, 409);
  assert.deepEqual((await (await request('alice', `/${row.id}`)).json()).completed, [0]);
});

test('Stage A: invalid inputs do not create guides', async t => {
  const { request, rows } = await fixture(t);
  for (const input of [{}, { goal: 'x', context: { url: 'https://example.com', title: '' } }, { goal: 'Help me', context: { url: 'https://example.com', title: '', screenshot: 'not-an-image' } }]) {
    assert.equal((await request('alice', '', 'POST', input)).status, 400);
  }
  assert.equal(rows.size, 0);
});

test('Stage A: database outage gives an understandable error and server recovers', async t => {
  const { request, state } = await fixture(t);
  state.unavailable = true;
  const response = await request('alice');
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Database request failed/);
  state.unavailable = false;
  assert.equal((await request('alice')).status, 200);
});
