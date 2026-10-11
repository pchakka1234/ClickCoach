import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app.js";
const id = "11111111-1111-4111-8111-111111111111";
const config = {
  supabaseUrl: "https://example.supabase.co",
  supabaseKey: "public-test",
  extensionId: "a".repeat(32),
};
async function fixture(
  t,
  { result = { data: null, error: null }, useMockPlanner = false } = {},
) {
  const calls = [];
  const query = {};
  for (const name of [
    "select",
    "eq",
    "order",
    "limit",
    "insert",
    "update",
    "delete",
    "single",
    "maybeSingle",
  ])
    query[name] = (...args) => {
      calls.push([name, ...args]);
      return query;
    };
  query.then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject);
  const clientFactory = (_u, _k, options) => {
    if (options.global)
      calls.push(["authorization", options.global.headers.Authorization]);
    return {
      auth: {
        getUser: async (token) => ({
          data: { user: token === "good" ? { id: "user-a" } : null },
          error: null,
        }),
      },
      from: () => query,
    };
  };
  const dependencies = { clientFactory };
  if (!useMockPlanner)
    dependencies.planner = async () => ({
      title: "Guide",
      summary: "Summary",
      steps: [
        {
          title: "Step",
          instruction: "Click button",
          expectedResult: "Menu opens",
        },
      ],
    });
  const app = createApp(
    { ...config, aiProvider: useMockPlanner ? "mock" : undefined },
    dependencies,
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    calls,
    request: (path, options = {}) => fetch(base + path, options),
  };
}
test("rejects missing and invalid JWTs", async (t) => {
  const { request } = await fixture(t);
  assert.equal((await request("/api/tutorials")).status, 401);
  assert.equal(
    (
      await request("/api/tutorials", {
        headers: { Authorization: "Bearer bad" },
      })
    ).status,
    401,
  );
});
test("uses the verified user and forwards their JWT for RLS", async (t) => {
  const { request, calls } = await fixture(t, {
    result: { data: [], error: null },
  });
  assert.equal(
    (
      await request("/api/tutorials", {
        headers: { Authorization: "Bearer good" },
      })
    ).status,
    200,
  );
  assert.ok(
    calls.some((c) => c[0] === "authorization" && c[1] === "Bearer good"),
  );
  assert.ok(
    calls.some((c) => c[0] === "eq" && c[1] === "user_id" && c[2] === "user-a"),
  );
});
test("rejects malformed JSON and unsafe page URLs", async (t) => {
  const { request } = await fixture(t);
  const headers = {
    Authorization: "Bearer good",
    "Content-Type": "application/json",
  };
  assert.equal(
    (await request("/api/tutorials", { method: "POST", headers, body: "{" }))
      .status,
    400,
  );
  assert.equal(
    (
      await request("/api/tutorials", {
        method: "POST",
        headers,
        body: JSON.stringify({
          goal: "Help me",
          context: { url: "javascript:alert(1)", title: "x" },
        }),
      })
    ).status,
    400,
  );
});
test("rejects progress outside the saved steps", async (t) => {
  const { request, calls } = await fixture(t, {
    result: { data: { steps: [{}] }, error: null },
  });
  const response = await request(`/api/tutorials/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer good",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currentStep: 2, completed: [], version: 1 }),
  });
  assert.equal(response.status, 400);
  assert.ok(!calls.some((c) => c[0] === "update"));
});
test("does not persist screenshots or URL query tokens", async (t) => {
  const { request, calls } = await fixture(t, {
    result: { data: { id }, error: null },
  });
  const response = await request("/api/tutorials", {
    method: "POST",
    headers: {
      Authorization: "Bearer good",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      goal: "Help me navigate",
      context: {
        url: "https://example.com/page?token=private#secret",
        title: "Example",
        screenshot: "data:image/jpeg;base64,YQ==",
      },
    }),
  });
  assert.equal(response.status, 201);
  const payload = calls.find((c) => c[0] === "insert")[1];
  assert.equal(payload.source_url, "https://example.com/page");
  assert.equal(payload.user_id, "user-a");
  assert.ok(!JSON.stringify(payload).includes("base64"));
});
test("uses the local mock planner when mock mode is enabled", async (t) => {
  const { request, calls } = await fixture(t, {
    result: { data: { id }, error: null },
    useMockPlanner: true,
  });
  const response = await request("/api/tutorials", {
    method: "POST",
    headers: {
      Authorization: "Bearer good",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      goal: "Test the full flow",
      context: { url: "https://example.com/", title: "Example" },
    }),
  });
  assert.equal(response.status, 201);
  const payload = calls.find((c) => c[0] === "insert")[1];
  assert.match(payload.summary, /No AI provider was contacted/);
  assert.equal(payload.steps.length, 3);
});
test("CORS grants only the configured extension origin", async (t) => {
  const { request } = await fixture(t);
  const bad = await request("/health", {
    headers: { Origin: "chrome-extension://" + "b".repeat(32) },
  });
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
  const good = await request("/health", {
    headers: { Origin: "chrome-extension://" + "a".repeat(32) },
  });
  assert.equal(
    good.headers.get("access-control-allow-origin"),
    "chrome-extension://" + "a".repeat(32),
  );
});
