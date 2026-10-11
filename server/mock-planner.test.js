import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMockPlan } from "./mock-planner.js";
import { planSchema } from "./schema.js";

test("mock planner creates a valid guide without external services", async () => {
  const plan = await generateMockPlan({
    goal: "Freeze the first row",
    context: {
      url: "https://example.com/sheet",
      title: "Example Sheet",
      screenshot: "data:image/jpeg;base64,YQ==",
    },
  });
  assert.equal(planSchema.safeParse(plan).success, true);
  assert.match(plan.title, /Freeze the first row/);
  assert.match(plan.summary, /No AI provider was contacted/);
  assert.equal(plan.steps.length, 3);
});
