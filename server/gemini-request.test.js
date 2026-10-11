import { test } from "node:test";
import assert from "node:assert/strict";
import { requestGemini } from "./gemini-request.js";

test("503 retries preserve the image request and recover", async () => {
  const body = JSON.stringify({
    contents: [
      { parts: [{ inlineData: { mimeType: "image/jpeg", data: "YQ==" } }] },
    ],
  });
  const calls = [];
  const delays = [];
  const success = { ok: true, status: 200 };
  const result = await requestGemini(
    "https://example.com",
    { body },
    async (url, options) => {
      calls.push(options);
      return calls.length < 3
        ? {
            ok: false,
            status: 503,
            json: async () => ({ error: { status: "UNAVAILABLE" } }),
          }
        : success;
    },
    async (ms) => delays.push(ms),
  );
  assert.equal(result, success);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.body === body));
  assert.ok(calls.every((call) => call.signal === calls[0].signal));
  assert.deepEqual(delays, [1000, 2000]);
});

test("persistent 503 stops after three attempts with actionable error", async () => {
  let count = 0;
  await assert.rejects(
    requestGemini(
      "https://example.com",
      {},
      async () => {
        count++;
        return { ok: false, status: 503, json: async () => ({}) };
      },
      async () => {},
    ),
    (e) => e.status === 503 && /3 attempts/.test(e.message),
  );
  assert.equal(count, 3);
});

test("invalid requests are not retried", async () => {
  let count = 0;
  await assert.rejects(
    requestGemini(
      "https://example.com",
      {},
      async () => {
        count++;
        return { ok: false, status: 400, json: async () => ({}) };
      },
      async () => {},
    ),
    /request format/,
  );
  assert.equal(count, 1);
});
