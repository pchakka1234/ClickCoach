// Read-only deployment checks. Never calls generation endpoints or Gemini.
import assert from 'node:assert/strict';
const base = new URL(process.argv[2]);
if (base.protocol !== 'https:') throw new Error('Expected hosted HTTPS URL');
const options = { signal: AbortSignal.timeout(90000) };
const health = await fetch(new URL('/health', base), options);
assert.equal(health.status, 200); assert.equal((await health.json()).ok, true);
console.log('PASS: hosted health endpoint');
const unauthorized = await fetch(new URL('/api/tutorials', base), { signal: AbortSignal.timeout(15000) });
assert.equal(unauthorized.status, 401);
assert.equal(unauthorized.headers.get('cache-control'), 'no-store');
console.log('PASS: unauthenticated requests blocked; private API is not cached');
for (const [origin, allowed] of [['chrome-extension://hemfkmakiclibfmmfcijmmmgbpjokenk', true], ['https://example.com', false]]) {
 const res = await fetch(new URL('/api/tutorials', base), { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' }, signal: AbortSignal.timeout(15000) });
 assert.equal(res.headers.get('access-control-allow-origin'), allowed ? origin : null);
}
console.log('PASS: distributed extension CORS allowed; unrelated origins denied');
