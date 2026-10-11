import { test } from "node:test";
import assert from "node:assert/strict";
import { generateGeminiPlan } from "./gemini-planner.js";

const input = {
  goal: "Freeze the first row",
  context: {
    url: "https://example.com/sheet",
    title: "Example Sheet",
    screenshot: "data:image/jpeg;base64,YQ==",
  },
};
const plan = {
  title: "Freeze the first row",
  summary: "Keep the heading visible.",
  steps: [
    {
      title: "Open View",
      instruction: "Click View.",
      expectedResult: "The View menu opens.",
    },
  ],
};

test("Gemini planner sends image input and validates structured output", async () => {
  let call;
  const request = async (url, options) => {
    call = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(plan) }] },
          },
        ],
      }),
    };
  };
  const result = await generateGeminiPlan(
    input,
    { geminiKey: "test-key", geminiModel: "gemini-test" },
    request,
  );
  assert.deepEqual(result, plan);
  assert.match(call.url, /gemini-test:generateContent$/);
  assert.equal(call.options.headers["x-goog-api-key"], "test-key");
  const body = JSON.parse(call.options.body);
  assert.equal(body.contents[0].parts[1].inlineData.mimeType, "image/jpeg");
  assert.equal(body.contents[0].parts[1].inlineData.data, "YQ==");
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "LOW");
});

test("Gemini planner reports free-tier quota exhaustion", async () => {
  const request = async () => ({
    ok: false,
    status: 429,
    json: async () => ({}),
  });
  await assert.rejects(
    () =>
      generateGeminiPlan(
        input,
        { geminiKey: "test-key", geminiModel: "gemini-test" },
        request,
      ),
    (error) => error.status === 429 && /rate or quota/.test(error.message),
  );
});

test('Gemini receives real control candidates and returns structured highlight targets', async () => {
  const target = { label: 'View feedback', role: 'button' };
  const grounded = { ...plan, steps: [{ ...plan.steps[0], target }] };
  let body;
  const result = await generateGeminiPlan({ ...input, context: { ...input.context, controls: [target] } }, { geminiKey: 'test', geminiModel: 'test' }, async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(grounded) }] } }] }) };
  });
  assert.deepEqual(JSON.parse(body.contents[0].parts[0].text).controls, [target]);
  assert.deepEqual(result.steps[0].target, target);
  assert.ok(body.generationConfig.responseJsonSchema.properties.steps.items.required.includes('target'));
});
